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

See the top-level `packages/`, `k8s/`, `docker/`, `terraform/`, and `.github/workflows/` directories.
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

## One-time AWS setup (Terraform)

Everything AWS-side — the VPC, the EKS cluster, the 3 ECR repos, the GitHub OIDC provider/role, and that
role's EKS access — is provisioned by [`terraform/`](terraform/). None of it is free-tier — see
**Cost / teardown**. No AWS console clicking required; just the AWS CLI configured with credentials that
can create VPC/EKS/IAM/ECR resources.

### 1. Configure and apply

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: set github_repository to "YOUR_GH_ORG/YOUR_REPO"

terraform init
terraform plan   # review what it's about to create
terraform apply
```

Takes ~15-20 minutes (mostly the EKS control plane). This creates:

- A VPC with public + private subnets across 2 AZs and a single NAT gateway
- The EKS cluster (`var.cluster_name`, default `micro-service`) with a 2-node `t3.medium` managed node group
- The 3 ECR repositories
- The GitHub OIDC provider (reused if one already exists in the account) and a role GitHub Actions can
  assume — no stored AWS access keys
- An EKS access entry granting that role `AmazonEKSClusterAdminPolicy`, so CI can `kubectl apply` and
  `rollout status` without any manual `aws eks create-access-entry` step

### 2. Wire up GitHub and kubectl

```bash
terraform output github_actions_role_arn
```

Add that value as a GitHub repo secret named `AWS_OIDC_ROLE_ARN` (Settings → Secrets and variables → Actions).

```bash
terraform output -raw configure_kubectl | sh    # or just copy/paste the printed command
```

Now a push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): typecheck → build and
push three images tagged with the commit SHA → `kubectl apply -k k8s/overlays/prod` → wait for rollout.

### 3. First deploy / checking it worked

```bash
kubectl get pods
kubectl get svc order-service   # EXTERNAL-IP is the LoadBalancer address
curl -X POST http://<EXTERNAL-IP>/orders -H 'content-type: application/json' \
  -d '{"sku":"SKU-1","quantity":1}'
```

## Cost / teardown

EKS control plane + 2x `t3.medium` + the NAT gateway + the LoadBalancer's ELB all bill continuously.
When you're done:

```bash
cd terraform
terraform destroy
```

That tears down the cluster, VPC, ECR repos, and the GitHub OIDC role in one step. If other repos/roles in
the account already relied on the GitHub OIDC *provider* before this, Terraform will have reused it rather
than created it, and won't delete it on destroy.
# micro-service-deployment
