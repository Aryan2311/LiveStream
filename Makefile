AWS_REGION   ?= us-east-1
EKS_CLUSTER  ?= live-dev
K8S_NS       ?= live-dev
ENV_NAME     ?= live-dev
TAG          ?= $(shell git rev-parse --short HEAD)
ACCOUNT_ID   ?= $(shell aws sts get-caller-identity --query Account --output text)
REGISTRY     ?= $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

SERVICES     = api auth-service stream-service chat-service
TF_DIR       = deploy/terraform/aws/environments/dev

.PHONY: help ecr-login build-go build-frontend build-images push-images \
        deploy-infra kubeconfig deploy-k8s deploy-all tf-init tf-plan tf-apply \
        bootstrap-state

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# ---------- State bootstrap (run once before first tf init) ----------

bootstrap-state: ## Create S3 bucket and DynamoDB table for Terraform state
	aws s3api create-bucket \
		--bucket $(ENV_NAME)-terraform-state \
		--region $(AWS_REGION)
	aws s3api put-bucket-versioning \
		--bucket $(ENV_NAME)-terraform-state \
		--versioning-configuration Status=Enabled
	aws dynamodb create-table \
		--table-name $(ENV_NAME)-terraform-locks \
		--attribute-definitions AttributeName=LockID,AttributeType=S \
		--key-schema AttributeName=LockID,KeyType=HASH \
		--billing-mode PAY_PER_REQUEST \
		--region $(AWS_REGION)

# ---------- Terraform ----------

tf-init: ## Initialize Terraform
	cd $(TF_DIR) && terraform init

tf-plan: ## Plan Terraform changes
	cd $(TF_DIR) && terraform plan

tf-apply: ## Apply Terraform changes
	cd $(TF_DIR) && terraform apply

deploy-infra: tf-init tf-apply ## Provision AWS infrastructure

# ---------- Docker ----------

ecr-login: ## Login to ECR
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(REGISTRY)

build-go: ## Build all Go service images
	@for svc in $(SERVICES); do \
		echo "Building $$svc..."; \
		docker build -t $(REGISTRY)/$(ENV_NAME)/$$svc:$(TAG) \
			--build-arg SERVICE=$$svc \
			-f deploy/docker/Dockerfile.app .; \
	done

build-frontend: ## Build frontend image
	docker build -t $(REGISTRY)/$(ENV_NAME)/frontend:$(TAG) \
		-f deploy/docker/Dockerfile.frontend .

build-images: build-go build-frontend ## Build all Docker images

push-images: ecr-login ## Push all images to ECR
	@for svc in $(SERVICES); do \
		docker push $(REGISTRY)/$(ENV_NAME)/$$svc:$(TAG); \
	done
	docker push $(REGISTRY)/$(ENV_NAME)/frontend:$(TAG)

# ---------- Kubernetes ----------

kubeconfig: ## Update kubeconfig for the EKS cluster
	aws eks update-kubeconfig --name $(EKS_CLUSTER) --region $(AWS_REGION)

deploy-k8s: ## Deploy to EKS using Kustomize
	@cd deploy/k8s/overlays/dev && \
		sed -i.bak "s|ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com|$(REGISTRY)|g" kustomization.yaml && \
		sed -i.bak "s|newTag: latest|newTag: $(TAG)|g" kustomization.yaml && \
		rm -f kustomization.yaml.bak
	kubectl create namespace $(K8S_NS) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -k deploy/k8s/overlays/dev/
	@echo "Waiting for rollout..."
	@for deploy in frontend api auth-service stream-service chat-service mediamtx; do \
		kubectl rollout status deployment/$$deploy -n $(K8S_NS) --timeout=300s; \
	done
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n $(K8S_NS)

# ---------- Full deploy ----------

deploy-all: deploy-infra kubeconfig build-images push-images deploy-k8s ## Full deployment pipeline

# ---------- GCP demo (low-cost) ----------

GCP_PROJECT  ?= $(shell gcloud config get-value project 2>/dev/null)
GCP_REGION   ?= us-central1
GCP_ZONE     ?= us-central1-a
GCP_NAME     ?= live-demo
GCP_TF_DIR   = deploy/terraform/gcp/environments/demo
GCP_REGISTRY ?= $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/$(GCP_NAME)-images
GCP_SERVICES = api auth-service stream-service chat-service frontend

gcp-tf-init: ## Initialize GCP demo Terraform
	cd $(GCP_TF_DIR) && terraform init

gcp-tf-plan: ## Plan GCP demo infrastructure
	cd $(GCP_TF_DIR) && terraform plan

gcp-tf-apply: ## Apply GCP demo infrastructure
	cd $(GCP_TF_DIR) && terraform apply

gcp-deploy-infra: gcp-tf-init gcp-tf-apply ## Provision GCP demo VM + Artifact Registry

gcp-auth-docker: ## Configure Docker for Artifact Registry
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet

gcp-build-go: ## Build Go service images for GCP
	@for svc in api auth-service stream-service chat-service; do \
		echo "Building $$svc..."; \
		docker build -t $(GCP_REGISTRY)/$$svc:$(TAG) \
			--build-arg SERVICE=$$svc \
			-f deploy/docker/Dockerfile.app .; \
	done

gcp-build-frontend: ## Build frontend image for GCP
	docker build -t $(GCP_REGISTRY)/frontend:$(TAG) \
		-f deploy/docker/Dockerfile.frontend .

gcp-build-images: gcp-build-go gcp-build-frontend ## Build all GCP demo images

gcp-push-images: gcp-auth-docker ## Push images to Artifact Registry
	@for svc in $(GCP_SERVICES); do \
		docker push $(GCP_REGISTRY)/$$svc:$(TAG); \
	done

gcp-build-push: gcp-build-images gcp-push-images ## Build and push all GCP demo images

gcp-restart-demo: ## Re-run startup script on the demo VM
	gcloud compute instances reset $(GCP_NAME)-demo --zone $(GCP_ZONE) --project $(GCP_PROJECT)

gcp-deploy-all: gcp-build-push gcp-deploy-infra ## Build images, push, and provision GCP demo

gcp-outputs: ## Show GCP demo URLs
	@terraform -chdir=$(GCP_TF_DIR) output

gcp-apply-domain: ## Apply Cloudflare domain on live VM (DOMAIN=... CERT=... KEY=...)
	@test -n "$(DOMAIN)" || (echo "Set DOMAIN, CERT, and KEY, e.g. make gcp-apply-domain DOMAIN=live.example.com CERT=deploy/terraform/gcp/environments/demo/cloudflare-origin.pem KEY=deploy/terraform/gcp/environments/demo/cloudflare-origin-key.pem" && exit 1)
	powershell -File scripts/gcp-apply-domain.ps1 -Domain "$(DOMAIN)" -CertFile "$(CERT)" -KeyFile "$(KEY)"
