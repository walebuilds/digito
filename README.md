
# Digito — DevOps Engineering, IaC & CI/CD Automation

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue?logo=githubactions)](https://github.com/Feezcodev/digito/actions)
[![Infrastructure as Code](https://img.shields.io/badge/IaC-Terraform-844FBA?logo=terraform)](https://developer.hashicorp.com/terraform)
[![Cloud](https://img.shields.io/badge/Cloud-AWS-FF9900?logo=amazonaws)](https://aws.amazon.com/)
[![Containers](https://img.shields.io/badge/Containers-Docker-2496ED?logo=docker)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/Security-Trivy-1904DA)](https://trivy.dev/)

## Overview

This repository demonstrates my hands-on DevOps engineering work on **Digito**, an open-source, framework-agnostic OTP input component library.

I extended the project with automated CI/CD workflows, Docker containerization, security scanning, and Terraform-based AWS infrastructure configuration.

The goal is to make application validation more repeatable, automate container delivery, manage cloud resources as code, and establish a foundation for reliable application deployments.

**My focus:** CI/CD automation, Infrastructure as Code, cloud infrastructure, containerization, and DevSecOps.

## Architecture & Delivery Workflow

```text
 Developer Push / Pull Request
              |
              v
       GitHub Repository
              |
              v
        GitHub Actions
         /          \
        v            v
  Build, Test     Trivy Security
    & Lint           Scan
        \            /
         v          v
       Validation Results

              |
              v
      Deployment Workflow
              |
              v
       Docker Image Build
              |
              v
       Amazon ECR Registry
              |
              v
       EC2 SSH Deployment
              |
              v
       Running Application


       Infrastructure as Code
              |
              v
        Terraform Configuration
              |
              v
       AWS Infrastructure Resources
```

The CI workflow validates code changes and runs a Trivy filesystem vulnerability scan. The deployment workflow builds a Docker image, pushes it to Amazon ECR, and connects to the configured EC2 host over SSH to deploy the container.

Terraform is maintained separately to define AWS infrastructure resources.

## DevOps Engineering Contributions

### 1. CI/CD Automation with GitHub Actions

- Configured GitHub Actions workflows for pushes and pull requests targeting `main`.
- Automated dependency installation using npm.
- Integrated available linting, testing, and validation commands.
- Created a separate deployment workflow for publishing container images and deploying to EC2.
- Improved repeatability and visibility of application delivery.

### 2. Infrastructure as Code with Terraform

Added Terraform configuration to define AWS infrastructure resources programmatically.

The current configuration includes:

- AWS provider configuration and region selection.
- An S3 backend configuration for Terraform state.
- Terraform state encryption and a DynamoDB state-locking table reference.
- EC2 instances for application hosting.
- Security groups and network access rules.
- An Application Load Balancer (ALB) and target group.
- Amazon ECR repository configuration.
- An S3 bucket with versioning and server-side encryption.
- An Amazon RDS PostgreSQL database configuration.
- An output for the ECR repository URL.

This work demonstrates infrastructure definition through code rather than relying exclusively on manual cloud-console configuration.

### 3. Docker Containerization

- Created a multi-stage Dockerfile using Node.js Alpine images.
- Separated the application build stage from the runtime stage.
- Configured Docker Compose for a local development environment.
- Prepared the application for container image distribution through Amazon ECR.
- Used container-based deployment to improve consistency across environments.

### 4. AWS Cloud Integration

Integrated AWS services into the delivery and infrastructure workflows:

| Service | Purpose |
|---|---|
| Amazon EC2 | Application hosting |
| Amazon ECR | Container image registry |
| Amazon S3 | Application data bucket and Terraform state backend configuration |
| Amazon RDS | PostgreSQL database configuration |
| Application Load Balancer | HTTP traffic distribution configuration |
| IAM | AWS access and permissions |
| CloudWatch | AWS monitoring and logging capabilities |

The infrastructure configuration and deployment workflow represent separate parts of the project. Resource provisioning and end-to-end integration should be validated before treating the complete architecture as operational.

### 5. DevSecOps & Security Scanning

- Integrated Trivy filesystem vulnerability scanning into GitHub Actions.
- Configured the scanner to report HIGH and CRITICAL findings.
- Added automated checks to support earlier visibility into potential vulnerabilities.
- Used GitHub-hosted runners to execute the configured validation and security jobs.

Security scanning helps identify issues but does not, by itself, guarantee that an application is secure.

## Technology Stack

| Category | Technologies |
|---|---|
| Version Control | Git, GitHub |
| CI/CD | GitHub Actions |
| Infrastructure as Code | Terraform |
| Cloud Platform | AWS |
| Compute | Amazon EC2 |
| Container Registry | Amazon ECR |
| Storage | Amazon S3 |
| Database | Amazon RDS, PostgreSQL |
| Networking | VPC, Security Groups, Application Load Balancer |
| Containerization | Docker, Docker Compose |
| Security | Trivy |
| Application Runtime | Node.js, npm |
| Automation Environment | Linux, Bash |

## Repository Structure

```text
digito/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── terraform/
│   └── main.tf
├── src/
├── tests/
├── examples/
├── assets/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

The repository also contains application build configuration, test files, and supporting project documentation.

## Getting Started

### Prerequisites

- Git
- Node.js 20 and npm
- Docker and Docker Compose
- Terraform CLI for infrastructure work
- AWS CLI and an appropriately configured AWS account for AWS operations

### 1. Clone the repository

```bash
git clone https://github.com/Feezcodev/digito.git
cd digito
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Run application checks

```bash
npm run lint --if-present
npm test --if-present
```

### 4. Build the Docker image

```bash
docker build -t digito:local -f dockerfile .
```

### 5. Start the local development environment

```bash
docker compose up --build
```

Review `docker-compose.yml` and the application's startup configuration to confirm the expected port and runtime commands for your environment.

## Terraform Workflow

Navigate to the Terraform configuration directory:

```bash
cd terraform
```

Initialize Terraform:

```bash
terraform init
```

Check formatting and validate the configuration:

```bash
terraform fmt -check
terraform validate
```

Review the proposed infrastructure changes:

```bash
terraform plan
```

**Important:** Run `terraform apply` only after reviewing the plan, verifying the AWS configuration, and confirming that credentials, state storage, resource settings, and application bootstrap commands are correct.

The current configuration references an existing S3 backend and DynamoDB lock table. These backend resources must be available before initialization can succeed.

Never commit AWS credentials, database passwords, private SSH keys, or Terraform state files to the repository.

## GitHub Actions Configuration

The repository contains separate workflows for CI/security validation and deployment.

### CI and security workflow

File: `.github/workflows/ci.yml`

- Runs on pushes and pull requests targeting `main`.
- Checks out the repository.
- Sets up Node.js 20 and npm caching.
- Installs project dependencies.
- Runs configured linting and tests.
- Runs Trivy filesystem scanning for HIGH and CRITICAL vulnerabilities.

### Deployment workflow

File: `.github/workflows/deploy.yml`

- Runs on pushes to `main`.
- Configures AWS credentials.
- Authenticates with Amazon ECR.
- Builds and pushes the Docker image.
- Connects to the configured EC2 instance through SSH.
- Pulls the image and replaces the running application container.

The deployment workflow expects the following GitHub Actions secrets:

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication |
| `EC2_HOST` | EC2 deployment host |
| `EC2_SSH_KEY` | Private SSH key for deployment |

Use least-privilege AWS permissions and protect deployment secrets. For production environments, consider short-lived AWS credentials through GitHub OIDC rather than long-lived access keys.

## Validation & Engineering Outcomes

The configured CI checks have been run, and the project work has included validation of the implemented workflows.

This project demonstrates practical experience with:

- Automating application validation through CI pipelines.
- Containerizing an application with Docker.
- Publishing container images to Amazon ECR.
- Automating remote application deployment.
- Defining cloud infrastructure with Terraform.
- Integrating vulnerability scanning into development workflows.
- Documenting infrastructure, deployment requirements, and operational procedures.

Terraform provisioning and the full AWS deployment architecture should be verified independently before claiming that every defined resource and integration is running successfully.

## Future Improvements

- Introduce Terraform modules and reusable environment configurations.
- Move sensitive configuration into AWS Secrets Manager or Systems Manager Parameter Store.
- Restrict SSH access to trusted IP ranges or use AWS Systems Manager.
- Implement GitHub OIDC for AWS authentication.
- Add Terraform formatting, validation, security scanning, and plan checks to CI.
- Publish immutable Docker image tags instead of relying only on `latest`.
- Add deployment health checks and automatic rollback.
- Configure HTTPS, centralized monitoring, and alerting.
- Validate the ALB, EC2, ECR, and application networking as one end-to-end deployment.

## About Me

I'm **Feezco, a DevOps Engineer** focused on CI/CD automation, Infrastructure as Code, AWS cloud infrastructure, containerization, and DevSecOps.

I build hands-on projects to strengthen my engineering skills and demonstrate practical automation, infrastructure management, and software delivery.

- GitHub: [@Feezcodev](https://github.com/Feezcodev)
- Project: [Digito DevOps Implementation](https://github.com/Feezcodev/digito)

*One project. One skill. One opportunity at a time.*

## Acknowledgements

This repository is a fork of [walebuilds/digito](https://github.com/walebuilds/digito).

Credit goes to the original author and contributors for the Digito application. My contributions focus on DevOps automation, containerization, Terraform-based infrastructure configuration, security scanning, and supporting documentation.

Please refer to the original project's license and contribution guidelines when using or modifying its code.
