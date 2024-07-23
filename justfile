export ECR_HOST := "817545410935.dkr.ecr.us-east-1.amazonaws.com"

warn-if-git-diff:
    #!/usr/bin/env bash
    set -e
    set -o pipefail
    if ! git diff-index --quiet HEAD --; then
        echo -e "\033[0;31mWarning\033[0m: There are unstaged changes. in the following files:"
        PAGER=cat git diff --name-only
        echo -e "\033[0;31mWarning\033[0m: Are you sure you want to continue? (y/n)"
        read -r response
        if [ "$response" != "y" ]; then
            echo "Exiting due to unstaged changes."
            exit 1
        fi
    fi

ecr_login:
    #!/usr/bin/env bash
    set -e
    set -o pipefail
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "${ECR_HOST}"
    
# (ecr_login)
build: (warn-if-git-diff) (ecr_login)
    #!/usr/bin/env bash
    set -e
    set -o pipefail

    ECR_HOST="817545410935.dkr.ecr.us-east-1.amazonaws.com"
    IMAGE_NAME="tune-vault"
    GIT_COMMIT_HASH=$(git rev-parse --short HEAD)
    docker build --build-arg="LOCAL=false" --build-arg="GIT_COMMIT_HASH=${GIT_COMMIT_HASH}" --progress=plain -t ${IMAGE_NAME}:${GIT_COMMIT_HASH} .

    # IMAGE_URI=${ECR_HOST}/${IMAGE_NAME}:${GIT_COMMIT_HASH}
    IMAGE_URI=${ECR_HOST}/${IMAGE_NAME}:latest
    #! IMAGE_URI_BRANCH=${ECR_HOST}/${IMAGE_NAME}:prod

    echo "Tagging ${IMAGE_NAME}:${GIT_COMMIT_HASH} as:\n - ${IMAGE_URI}\n - ${IMAGE_URI_BRANCH}"

    docker tag ${IMAGE_NAME}:${GIT_COMMIT_HASH} ${IMAGE_URI}
    #! docker tag ${IMAGE_NAME}:${GIT_COMMIT_HASH} ${IMAGE_URI_BRANCH}
    docker push ${IMAGE_URI}
    #! docker push ${IMAGE_URI_BRANCH}

update-and-restart: (ecr_login)
    #!/usr/bin/env bash
    set -e
    set -o pipefail
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    aws ecs update-service --cluster "tune-vault" --service "tune-vault-service" --force-new-deployment

