
 Features
Core Features
- Log daily water consumption (e.g., 500ml, 1L, etc.)
- View progress toward a customizable daily hydration goal
- See hydration history with persistent data

Implemented
Quick-add buttons for common quantities (250ml, 500ml)
Support for multiple units (ml, L)
Persistent storage using JSON file / local database

 Tech Stack

| Layer    | Technology           |
|----------|----------------------|
| Frontend | HTML, CSS, JavaScript|
| Backend  | Node.js, Express.js  |
| Storage  | MongoDB Database     |

Installation & Usage

1. Clone the repository

git clone https://github.com/your-username/water-intake-tracker.git
cd water-intake-tracker

2. Run the command by navigating to project folder
   npm i    (to install dependencies and node modules)

3.To run the project run command
  npm run dev

4. Create .env file and add
  MONGODB_URI=mongodb://localhost:27017/watertracker
  PORT=3000
   the project will be running on
   http://localhost:3000/
