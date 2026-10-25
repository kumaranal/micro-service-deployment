# EKS 1.23+ no longer provisions EBS volumes in-tree — without the CSI driver, the default gp2
# StorageClass accepts PVCs but never binds them, so Kafka's volumeClaimTemplate stays Pending.
# The driver's controller needs its own IAM role (IRSA) to create/attach volumes.
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${var.cluster_name}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = module.ebs_csi_irsa.iam_role_arn

  # Defaults request ~336Mi per node (2 controller replicas x 6 containers + the node pod) —
  # over half a t3.micro's ~518Mi allocatable, leaving no room for Kafka. One controller and
  # requests closer to real usage keep the driver at ~150Mi total.
  configuration_values = jsonencode({
    controller = {
      replicaCount = 1
      resources    = local.ebs_csi_small
    }
    node = { resources = local.ebs_csi_small }
    sidecars = {
      for s in ["provisioner", "attacher", "snapshotter", "resizer", "livenessProbe", "nodeDriverRegistrar"] :
      s => { resources = local.ebs_csi_small }
    }
  })

  # Its controller pods need somewhere to schedule.
  depends_on = [module.eks]
}

locals {
  ebs_csi_small = {
    requests = { cpu = "10m", memory = "16Mi" }
    limits   = { memory = "128Mi" }
  }
}
