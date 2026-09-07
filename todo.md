# Project TODO

- [x] Define database schema for operator/admin users, daily tasks, video submissions, review history, and durable storage metadata
- [x] Add server-side role guards for operator and admin workflows
- [x] Add daily task creation, assignment, date-specific instructions, and operator visibility
- [x] Add secure backend video upload handling using multipart transport, temporary-file inspection, and object-storage references rather than database file bytes
- [x] Enforce 1080p minimum resolution using server-side ffprobe metadata verification before accepting a submission
- [x] Record submission metadata including operator, task, filename, storage key, storage URL, resolution, size, duration, submitted timestamp, and status
- [x] Add operator workspace with assigned daily tasks, upload flow, validation feedback, and submission history
- [x] Add admin dashboard with review queue, video preview, status/operator/date filters, and submission metadata
- [x] Add approve/reject workflow with mandatory actionable rejection comments
- [x] Show review status and admin feedback to operators for every submission
- [x] Establish an elegant, polished responsive visual system with accessible loading, empty, success, and error states
- [x] Add Vitest coverage for upload validation, role authorization, and review rules
- [x] Run type checks, tests, and browser visual verification
- [x] Save the final project checkpoint for delivery

- [x] Verify the configured GitHub remote, branch, and author identity for delivery
- [x] Push the completed application to the user's GitHub repository without overwriting unrelated remote changes
- [x] Confirm the pushed commit and repository URL to the user
