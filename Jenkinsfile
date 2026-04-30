pipeline {
    agent any
    environment {
        // Your absolute local path
        PROJECT_DIR = "/Users/risshab/projects/SynopsisEval"
        GITHUB_AUTH = credentials('github-pat')
        REPO_URL = "github.com/your-username/SynopsisEval_DevOps.git"
    }
    stages {
        stage('Initialize') {
            steps {
                // This forces every subsequent step to happen in your folder
                dir("${env.PROJECT_DIR}") {
                    echo "Working in ${env.PROJECT_DIR}"
                }
            }
        }
        // ... wrap other stages in dir("${env.PROJECT_DIR}") { ... }
    }
}