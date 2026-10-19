terraform {
  backend "s3" {
    bucket         = "feezcodev-digito-tf-state"
    key            = "app/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-locking"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# --- Networking & Security Groups ---
data "aws_vpc" "default_vpc" {
  default = true
}

data "aws_subnets" "default_subnet" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default_vpc.id]
  }
}

resource "aws_security_group" "instances" {
  name        = "instance-security-group-digito"
  description = "Security group for application EC2 instances"
  vpc_id      = data.aws_vpc.default_vpc.id
}

resource "aws_security_group_rule" "allow_http_inbound" {
  type              = "ingress"
  security_group_id = aws_security_group.instances.id
  from_port         = 8080
  to_port           = 8080
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "allow_ssh_inbound" {
  type              = "ingress"
  security_group_id = aws_security_group.instances.id
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "allow_all_outbound" {
  type              = "egress"
  security_group_id = aws_security_group.instances.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# --- EC2 Instances (t3.micro) with Docker Deployment ---
resource "aws_instance" "instance_1" {
  ami             = "ami-011899242bb902164" # Ubuntu 20.04 LTS // us-east-1
  instance_type   = "t3.micro"
  vpc_security_group_ids = [aws_security_group.instances.id]
  
  user_data = <<-EOF
              #!/bin/bash
apt-get update -y
apt-get install -y docker.io awscli

# 1. Log into Amazon ECR using the AWS CLI
aws ecr get-login-password --region <YOUR_AWS_REGION> | docker login --username AWS --password-stdin <YOUR_ECR_REGISTRY_URL>

# 2. Pull your container image from your private ECR repository
docker pull <YOUR_ECR_REGISTRY_URL>/digito:latest

# 3. Run your Node.js/TypeScript application container on port 8080
docker run -d --name digito-app --restart always -p 8080:8080 <YOUR_ECR_REGISTRY_URL>/digito:latest
              EOF

  tags = {
    Name = "digito-app-instance-1"
  }
}

resource "aws_instance" "instance_2" {
  ami             = "ami-011899242bb902164" # Ubuntu 20.04 LTS // us-east-1
  instance_type   = "t3.micro"
  vpc_security_group_ids = [aws_security_group.instances.id]
  
  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              apt-get install -y docker.io git curl
              systemctl start docker
              systemctl enable docker

              # Pull and run the containerized TypeScript/Node.js application on port 8080
              docker pull feezcodev/digito:latest
              docker run -d --name digito-app --restart always -p 8080:8080 feezcodev/digito:latest
              EOF

  tags = {
    Name = "digito-app-instance-2"
  }
}

# --- Application Load Balancer ---
resource "aws_security_group" "alb" {
  name        = "alb-security-group-digito"
  description = "Security group for Application Load Balancer"
  vpc_id      = data.aws_vpc.default_vpc.id
}

resource "aws_security_group_rule" "allow_alb_http_inbound" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "allow_alb_all_outbound" {
  type              = "egress"
  security_group_id = aws_security_group.alb.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_lb" "load_balancer" {
  name               = "digito-app-lb"
  load_balancer_type = "application"
  subnets            = data.aws_subnets.default_subnet.ids
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "instances" {
  name     = "digito-target-group"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default_vpc.id

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 3
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group_attachment" "instance_1" {
  target_group_arn = aws_lb_target_group.instances.arn
  target_id        = aws_instance.instance_1.id
  port             = 8080
}

resource "aws_lb_target_group_attachment" "instance_2" {
  target_group_arn = aws_lb_target_group.instances.arn
  target_id        = aws_instance.instance_2.id
  port             = 8080
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.load_balancer.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.instances.arn
  }
}

# --- S3 Application Data Bucket ---
resource "aws_s3_bucket" "bucket" {
  bucket_prefix = "digito-app-data-"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "bucket_versioning" {
  bucket = aws_s3_bucket.bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bucket_crypto_conf" {
  bucket = aws_s3_bucket.bucket.bucket
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- RDS PostgreSQL Database Tier ---
resource "aws_db_instance" "db_instance" {
  allocated_storage          = 20
  auto_minor_version_upgrade = true
  storage_type               = "gp3"
  engine                     = "postgres"
  engine_version             = "12"
  instance_class             = "db.t3.micro"
  db_name                    = "digito"
  username                   = "dbuser"
  password                   = "securepassword123"
  skip_final_snapshot        = true
}
resource "aws_ecr_repository" "app_repo" {
  name = "digito"
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app_repo.repository_url
}