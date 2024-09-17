terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_ecr_repository" "release_control" {
  name = "${var.project_name}-api"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_secretsmanager_secret" "database_url" {
  name = "${var.project_name}/database-url"
}

output "ecr_repository_url" {
  value = aws_ecr_repository.release_control.repository_url
}
