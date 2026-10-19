# AWS Scalable Web Application Infrastructure (Terraform)

This module provisions a highly available, secure, and scalable multi-tier web application architecture on AWS, managed entirely via Terraform with a remote S3 backend and state locking.

---

## 🏗️ Architecture Overview

The infrastructure consists of the following core components:
- **Compute Layer**: Two Amazon EC2 instances (`t3.micro`) running Ubuntu 20.04 LTS, configured with automated `user_data` bootstrap scripts that install Node.js, clone your repository (`digito`), build the TypeScript application, and run it on port 8080.
- **Load Balancing**: An Application Load Balancer (ALB) distributed across default VPC subnets, forwarding HTTP traffic from port 80 to the instance target groups.
- **Storage Layer**: An Amazon S3 bucket with server-side encryption (`AES256`) and versioning enabled for application data assets.
- **Database Tier**: An Amazon RDS PostgreSQL database instance (Engine version 12) utilizing `gp3` storage performance for lightweight workloads (`db.t3.micro`).
- **State Management**: Uses remote state stored in an S3 bucket (`feezcodev-digito-tf-state`) with concurrency locking handled via DynamoDB (`terraform-state-locking`).

---

## 📁 Directory Structure

```text
web-app/
├── main.tf          # Core infrastructure resources (Compute, ALB, S3, RDS, Security Groups)
├── architecture.png # Visual system architecture diagram
└── README.md        # Module documentation