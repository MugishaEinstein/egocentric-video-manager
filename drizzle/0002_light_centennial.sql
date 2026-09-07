CREATE TABLE `review_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`status` enum('approved','rejected') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_history_id` PRIMARY KEY(`id`)
);
