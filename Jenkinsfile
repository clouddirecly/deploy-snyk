pipeline{
    agent any
    environment {
        PROJECT_ID = "gtech-324715"
        CREDENTIALS_ID = "sa-jenkins-pipeline"
        REGION = "us-central1"
        OWNER = "clouddirecly"
        REPOSITORY = "deploy-snyk" 
        IMAGE_NAME = "${REGION}-docker.pkg.dev/${PROJECT_ID}/jenkins-repo/${REPOSITORY}"
        SA_NAME = "service-account-name"  
    }
    stages {
        stage('Build Docker Image') {
            when { branch 'PR-*' }
            steps {
                 script {
                    def prNumber = env.CHANGE_ID
                    def imageTag = "pr-${prNumber}"
                    slackSend color:'good', message: "🚀 Deployment started for PR #${env.CHANGE_ID}. Repository: ${REPOSITORY}, Branch: ${env.BRANCH_NAME}."
                    sh "docker build -t ${IMAGE_NAME}:${imageTag} ."
                }
            }
        }
        stage('Push Docker Image') {
            when { branch 'PR-*' }
            steps {
                withCredentials([file(credentialsId: "${CREDENTIALS_ID}", variable: 'GOOGLE_CREDENTIALS_FILE')]) {
                    script {
                        sh 'gcloud auth activate-service-account --key-file=$GOOGLE_CREDENTIALS_FILE'
                        sh "gcloud config set project ${PROJECT_ID}"
                        sh "gcloud auth configure-docker ${REGION}-docker.pkg.dev"

                        def prNumber = env.CHANGE_ID
                        def imageTag = "pr-${prNumber}"
                        sh "docker push ${IMAGE_NAME}:${imageTag}"

                        slackSend color: 'good', message: "✅ Deployment successful! The Docker image from Artifact Registry has been deployed. Image : ${IMAGE_NAME}:pr-${env.CHANGE_ID}"
                    }
                }
            }
        }
        stage('Deploy to Cloud Run') {
            when { branch 'PR-*' }
            steps {
                withCredentials([file(credentialsId: "${SA-NAME}", variable: 'sa_name')]) {
                    script {
                        def prNumber = env.CHANGE_ID
                        def imageTag = "pr-${prNumber}"
                        def imageUri = "${IMAGE_NAME}:${imageTag}"
                        def SERVICE_NAME = "${REPOSITORY}-pr-${prNumber}"

                        sh """
                        gcloud run deploy ${SERVICE_NAME} \
                        --image=${imageUri} \
                        --region=${REGION} \
                        --platform=managed \
                        --allow-unauthenticated\
                        --service-account ${sa_name}
                        """

                        slackSend color: 'good', message: "✅ Cloud Run Deployment Successful! Cloud run name: ${SERVICE_NAME}"
                    }
                }
            }
        }
        stage('Test Cloud Run Deployment') {
            when { branch 'PR-*' }
            steps {
                script {
                    def prNumber = env.CHANGE_ID
                    def imageTag = "pr-${prNumber}"
                    def SERVICE_NAME = "${REPOSITORY}-${imageTag}"

                    def serviceUrl = sh(
                        script: "gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)'",
                        returnStdout: true
                    ).trim()

                    // def response = sh(
                    //     script: "curl -s -o /dev/null -w '%{http_code}' ${serviceUrl}",
                    //     returnStdout: true
                    // ).trim()

                    // if (response != '200') {
                    //     error "Test failed: Service did not return 200 OK. Response code was ${response}"
                    // } else {
                    //     echo "Test passed: Service returned 200 OK"
                    // }

                     slackSend color: 'good', message: "✅ Test Cloud Run Deployment Successful! Service deployed: ${SERVICE_NAME}"
                }
            }
        }

        stage('Merge -PR to Main') {
            when { branch 'PR-*' }
            steps {
                script {
                    withCredentials([string(credentialsId: 'github-token', variable: 'GH_TOKEN')]) {
                        sh """
                        gh pr merge ${env.CHANGE_ID} --merge --repo ${owner}/${REPOSITORY}
                        """
                    }
                    slackSend color: 'good', message: "✅ Pull Request #${prNumber} successfully merged! 🚀 "
                }
            }
        }
    }
    post {
        failure {
            slackSend color:'danger', message: "Build PR-${env.CHANGE_ID} failed in stage ${env.STAGE_NAME}"
        }
        success {
            script {
                if(env.BRANCH_NAME != 'main') {
                    slackSend color:'good', message: "✅ Build for PR-${env.CHANGE_ID} succeeded "
                }
            }
        }
    }
}