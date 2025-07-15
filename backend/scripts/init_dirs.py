import os

def init_project_structure():
    # Get absolute path of backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # List of directories to create
    directories = [
        'db',
        'resumes',
        'logs'
    ]
    
    # Create directories
    for dir_name in directories:
        dir_path = os.path.join(backend_dir, dir_name)
        os.makedirs(dir_path, exist_ok=True)
        print(f"Ensured directory exists: {dir_path}")

if __name__ == "__main__":
    init_project_structure()
    print("Project structure initialization completed.")