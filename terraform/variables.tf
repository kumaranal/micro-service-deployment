variable "aws_region" {
  description = "AWS region for every resource"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "micro-service"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "node_instance_type" {
  description = "EC2 instance type for the managed node group. t3.micro is free-tier eligible (750 combined hrs/month) but only has 1 GiB RAM — the k8s manifests tune Kafka's heap and pod resource requests down to fit."
  type        = string
  default     = "t3.micro"
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 3
}

variable "ecr_repositories" {
  description = "ECR repositories to create, one per service"
  type        = list(string)
  default     = ["order-service", "inventory-service", "notification-service"]
}

variable "github_repository" {
  description = "GitHub \"org/repo\" allowed to assume the CI role over OIDC, e.g. \"kumaranal/micro-service-deployment\""
  type        = string
}

variable "github_branch" {
  description = "Branch allowed to assume the CI role"
  type        = string
  default     = "main"
}
