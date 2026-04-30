pipeline {
    agent any

    parameters {
        string(name: 'COMMIT_MESSAGE', defaultValue: 'Dev update: working on features', description: 'Enter your git commit message')
    }

    environment {
        // This references a "Username with password" credential in Jenkins
        // Username = GitHub Username, Password = Your PAT
        GITHUB_AUTH = credentials('github-pat')
        REPO_URL = "github.com/your-username/SynopsisEval_DevOps.git"
    }

    stages {
        stage('1. Git Lifecycle') {
            steps {
                echo 'Staging, committing, and pushing changes via PAT...'
                sh """
                    # Update remote to use PAT for authentication
                    git remote set-url origin https://${GITHUB_AUTH_USR}:${GITHUB_AUTH_PSW}@${REPO_URL}
                    
                    git add .
                    # Only commit if there are changes to avoid build failure
                    if [ -n "\$(git status --porcelain)" ]; then
                        git commit -m "${params.COMMIT_MESSAGE}"
                        git push origin main
                    else
                        echo "No changes to commit."
                    fi
                """
            }
        }

        stage('2. Infrastructure Startup') {
            steps {
                echo 'Starting Docker Monitoring & Database stack...'
                sh 'docker compose up -d db prometheus grafana'
            }
        }

        stage('3. Local Dev Launch') {
            steps {
                echo 'Launching Local Development Servers...'
                script {
                    // Start Backend and Frontend in the background
                    // BUILD_ID=dontKillMe prevents Jenkins from killing background processes
                    sh """
                        export BUILD_ID=dontKillMe
                        
                        # Start Backend
                        cd backend
                        python3 -m venv venv
                        ./venv/bin/pip install -r requirements.txt
                        nohup ./venv/bin/uvicorn app.main:app --reload --port 8000 > backend.log 2>&1 &
                        
                        # Start Frontend
                        cd ../frontend
                        npm install
                        nohup npm run dev > frontend.log 2>&1 &
                    """
                }
                echo '✅ Workspace ready!'
                echo '   Backend: http://localhost:8000'
                echo '   Frontend: http://localhost:5173'
                echo '   Grafana: http://localhost:3001'
            }
        }
    }

    post {
        failure {
            echo '❌ Pipeline failed. Check console for Git conflicts or Docker errors.'
        }
    }
}