# micro-service

A tutorial Kafka-based microservice system: `order-service`, `inventory-service`, `notification-service`,
shipped via GitHub Actions → Amazon ECR → Amazon EKS.

## Architecture

- `order-service` — `POST /orders` creates an order and publishes `orders.created`.
- `inventory-service` — consumes `orders.created`, reserves stock, publishes `inventory.updated`.
- `order-service` and `notification-service` both consume `inventory.updated`: the order's status is
  updated, and `notification-service` logs a simulated "email sent".
- Kafka is a single-node KRaft broker — no ZooKeeper, nothing beyond what's already in the cluster/compose file.

Stack: Node 22, TypeScript, pnpm workspaces, Express, kafkajs.

## Repo layout

See the top-level `packages/`, `k8s/`, `docker/`, `eksctl/`, and `.github/workflows/` directories.
`packages/shared` holds the Kafka client wrapper, topic/event types, and logger used by all three services.

## Local development

### Option A — Docker Compose (closest to prod)

```bash
docker compose up --build
```

This starts Kafka (KRaft, single node) and all three services. Then:

```bash
curl -X POST localhost:3000/orders -H 'content-type: application/json' \
  -d '{"sku":"SKU-1","quantity":2}'
```

Watch the inventory/notification service logs — you'll see the reservation and the simulated email.
`SKU-3` has 0 stock, so ordering it exercises the `OUT_OF_STOCK` path.

### Option B — pnpm, against a local Kafka

```bash
pnpm install
docker run -d --name kafka -p 9092:9092 \
  -e KAFKA_NODE_ID=1 -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  apache/kafka:3.8.0
cp .env.example .env
pnpm dev
```

`pnpm dev` builds `@ms/shared` once, then runs all three services with `tsx watch`.

## One-time AWS setup

Everything below is done once per AWS account. None of it is free-tier — see **Cost / teardown**.

### 1. ECR repositories

```bash
for svc in order-service inventory-service notification-service; do
  aws ecr create-repository --repository-name "$svc" --region ap-south-1
done
```

### 2. EKS cluster

Requires `eksctl` and `kubectl`.

```bash
eksctl create cluster -f eksctl/cluster.yaml
```

Takes ~15-20 minutes. This also provisions an OIDC provider for the cluster (`iam.withOIDC: true`),
which you'll need for pod-level IAM later if you extend this tutorial.

### 3. GitHub Actions OIDC role (no stored AWS keys)

Create the GitHub OIDC identity provider (skip if your account already has one):

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Create the role (replace `ACCOUNT_ID`, `GITHUB_ORG/REPO`):

```bash
cat > trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:GITHUB_ORG/REPO:ref:refs/heads/main" }
    }
  }]
}
EOF

aws iam create-role \
  --role-name github-actions-micro-service \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name github-actions-micro-service \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

EKS access for the role is granted separately in cluster-level RBAC (step 4) — the ECR policy above is
only for push/pull.

Add the role's ARN as a GitHub repo secret named `AWS_OIDC_ROLE_ARN` (Settings → Secrets and variables → Actions).

### 4. Grant the role access to the EKS cluster

```bash
aws eks create-access-entry \
  --cluster-name micro-service \
  --principal-arn arn:aws:iam::ACCOUNT_ID:role/github-actions-micro-service

aws eks associate-access-policy \
  --cluster-name micro-service \
  --principal-arn arn:aws:iam::ACCOUNT_ID:role/github-actions-micro-service \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
  --access-scope type=cluster
```

Now a push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): typecheck → build and
push three images tagged with the commit SHA → `kubectl apply -k k8s/overlays/prod` → wait for rollout.

### 5. First deploy / checking it worked

```bash
kubectl get pods
kubectl get svc order-service   # EXTERNAL-IP is the LoadBalancer address
curl -X POST http://<EXTERNAL-IP>/orders -H 'content-type: application/json' \
  -d '{"sku":"SKU-1","quantity":1}'
```

## Cost / teardown

EKS control plane + 2x `t3.medium` + the LoadBalancer's ELB all bill continuously. When you're done:

```bash
eksctl delete cluster -f eksctl/cluster.yaml

for svc in order-service inventory-service notification-service; do
  aws ecr delete-repository --repository-name "$svc" --region ap-south-1 --force
done

aws iam detach-role-policy \
  --role-name github-actions-micro-service \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
aws iam delete-role --role-name github-actions-micro-service
```

Leave the OIDC provider in place if other repos/roles in the account use it; otherwise delete it with
`aws iam delete-open-id-connect-provider`.
# micro-service-deployment
