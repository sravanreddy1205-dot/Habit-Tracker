# Habit Tracker

A cloud-based web application designed to help users build positive habits, track daily progress, and maintain consistency through habit streaks and progress analytics.

## About the Project

Habit Tracker is developed using HTML, CSS, and JavaScript, with Amazon Web Services (AWS) providing authentication, backend processing, and cloud database storage.

Users can securely sign in, create habits, track completions, and monitor their progress through an interactive dashboard.

## Features

- **User Authentication:** Sign up and log in using Amazon Cognito.
- **Habit Management:** Add, view, complete, undo, and delete habits.
- **Streak Tracking:** Monitor consecutive days of habit completion.
- **Completion History:** Review previous habit activity using a calendar.
- **Progress Analytics:** View statistics and visual summaries of progress.
- **Modern UI:** Interactive dashboard with a modern design.

## Technologies Used

| Component | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Authentication | Amazon Cognito |
| API | Amazon API Gateway |
| Backend | AWS Lambda |
| Database | Amazon DynamoDB |

## Project Architecture

1. The frontend provides the user interface.
2. Amazon Cognito manages user authentication.
3. Amazon API Gateway receives API requests.
4. AWS Lambda processes habit-related operations.
5. Amazon DynamoDB stores habit records and completion data.

## Project Structure

``` text
Habit-Tracker/
├── FrontEnd/
│   └── index.html
├── backend/
│   └── lambda/
│       └── index.js
└── README.mdi
```

## How to Run

1. Clone or download the repository.
2. Open the project folder in Visual Studio Code.
3. Install the Live Server extension.
4. Open `FrontEnd/index.html` using Live Server.
5. Sign up or log in to use the application.

**Note:** The AWS backend must be deployed and configured correctly for authentication and habit operations to work.

## Security

- Never commit passwords, access tokens, or AWS secret access keys.
- Configure API Gateway CORS for the frontend's origin.
- Keep user data and authentication credentials protected.

## Future Enhancements

- Habit reminders and notifications.
- Weekly and monthly progress reports.
- Additional habit analytics.
- Improved mobile experience.

## Author

Developed as a cloud-based habit tracking project to demonstrate frontend development and AWS serverless technologies.
