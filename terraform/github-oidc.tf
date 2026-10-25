# Creates the GitHub OIDC provider (if one doesn't already exist in this account)
# and the role GitHub Actions assumes — no stored AWS access keys.
module "github_actions_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-github-oidc-role"
  version = "~> 5.0"

  name = "github-actions-${var.cluster_name}"

  subjects = ["repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"]

  policies = {
    ecr_power_user = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
  }
}
