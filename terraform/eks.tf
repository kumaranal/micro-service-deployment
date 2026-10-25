module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  # Whoever applies this gets cluster-admin too, in addition to the GitHub Actions role below.
  enable_cluster_creator_admin_permissions = true

  # t3.micro's default max-pods (4, from AWS's per-ENI IP table) is too low to fit Kafka + 3
  # services alongside aws-node/kube-proxy/coredns. Prefix delegation hands each ENI a /28 of
  # IPs instead of individual addresses, so the CNI can actually back far more pods per node.
  cluster_addons = {
    vpc-cni = {
      before_compute = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
    coredns    = {}
    kube-proxy = {}
  }

  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      desired_size   = var.node_desired_size
      min_size       = var.node_min_size
      max_size       = var.node_max_size

      # Must be explicit: without it, the module renders legacy AL2 bootstrap.sh-style user
      # data (ignoring cloudinit_pre_nodeadm below) even though AWS actually launches an
      # AL2023 AMI by default — which silently no-ops the maxPods override.
      ami_type = "AL2023_x86_64_STANDARD"

      # kubelet's own max-pods is a separate, node-bootstrap-time setting (AL2023 AMI uses the
      # nodeadm NodeConfig format) — prefix delegation alone doesn't raise it. 110 matches the
      # default used on larger instance types; real capacity here is still memory/CPU-bound.
      cloudinit_pre_nodeadm = [
        {
          content_type = "application/node.eks.aws"
          content      = <<-EOT
            ---
            apiVersion: node.eks.aws/v1alpha1
            kind: NodeConfig
            spec:
              kubelet:
                config:
                  maxPods: 110
          EOT
        }
      ]
    }
  }

  # Grants the CI role cluster-admin via EKS access entries — replaces the manual
  # `aws eks create-access-entry` / `associate-access-policy` steps.
  access_entries = {
    github_actions = {
      principal_arn = module.github_actions_role.arn

      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }
  }
}
