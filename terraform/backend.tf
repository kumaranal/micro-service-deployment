# Local state by default — fine for a tutorial / single operator.
# For anything shared, create an S3 bucket + DynamoDB lock table once, then uncomment:
#
# terraform {
#   backend "s3" {
#     bucket         = "your-tfstate-bucket"
#     key            = "micro-service/terraform.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "your-tfstate-lock-table"
#     encrypt        = true
#   }
# }
