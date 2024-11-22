pipeline{
    agent any
    environment {
        PROJECT_ID = "gtech-324715"
        CREDENTIALS_ID = "sa-jenkins-pipeline"
        REGION = "us-central1"
        OWNER = "clouddirecly"
        REPOSITORY = "deploy-snyk" 
        IMAGE_NAME = "${REGION}-docker.pkg.dev/${PROJECT_ID}/jenkins-repo/${REPOSITORY}"
        SERVICE_ACCOUNT_NAME = "sa-jenkins-pipeline@gtech-324715.iam.gserviceaccount.com" 
    }
    stages {
        stage('Build Docker Image') {
            when { branch 'PR-*' }
            steps {
                 script {         
                    slackSend color:'good', message: "🚀 Deployment started for PR #${env.CHANGE_ID}. Repository: ${REPOSITORY}, Branch: ${env.BRANCH_NAME}."
                    sh "docker build -t ${IMAGE_NAME}:pr-${env.CHANGE_ID} ."
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

                        sh "docker push ${IMAGE_NAME}:pr-${env.CHANGE_ID}"
                        slackSend color: 'good', message: "✅ Deployment successful! The Docker image from Artifact Registry has been deployed. Image : ${IMAGE_NAME}:pr-${env.CHANGE_ID}"
                    }
                }
            }
        }
        stage('Deploy to Cloud Run') {
            when { branch 'PR-*' }
            steps {
                script {  
                    sh """
                    gcloud run deploy ${REPOSITORY}-pr-${env.CHANGE_ID} \
                    --image=${IMAGE_NAME}:pr-${env.CHANGE_ID} \
                    --region=${REGION} \
                    --platform=managed \
                    --allow-unauthenticated\
                    --service-account ${SERVICE_ACCOUNT_NAME}
                    """
                    slackSend color: 'good', message: "✅ Cloud Run Deployment Successful! Cloud run name: ${REPOSITORY}-pr-${env.CHANGE_ID}"
                }    
            }
        }
        stage('Test Cloud Run Deployment') {
            when { branch 'PR-*' }
            steps {
                script {
                    def serviceUrl = sh(
                        script: "gcloud run services describe ${REPOSITORY}-pr-${env.CHANGE_ID} --region=${REGION} --format='value(status.url)'",
                        returnStdout: true
                    ).trim()
                    slackSend color: 'good', message: "✅ Test Cloud Run Deployment Successful! Service deployed"
                    // def response = sh(
                    //     script: "curl -s -o /dev/null -w '%{http_code}' ${serviceUrl}",
                    //     returnStdout: true
                    // ).trim()

                    // if (response != '200') {
                    //     error "Test failed: Service did not return 200 OK. Response code was ${response}"
                    // } else {
                    //     echo "Test passed: Service returned 200 OK"
                    // }

                     
                }
            }
        }

        stage('Merge -PR to Main') {
            when { branch 'PR-*' }
            steps {
                script {
                    withCredentials([string(credentialsId: 'github-token', variable: 'GH_TOKEN')]) {
        
                        sh """
                        gh pr merge ${env.CHANGE_ID} --merge --repo ${OWNER}/${REPOSITORY} 
                        """
                    }
                    slackSend color: 'good', message: "✅ Pull Request #${env.CHANGE_ID} successfully merged! 🚀 "
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