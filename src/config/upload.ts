import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, "uploads/avatars");
	},
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		cb(null, `${crypto.randomUUID()}${ext}`);
	},
});

export const uploadAvatar = multer({
	storage,
	limits: { fileSize: MAX_SIZE },
	fileFilter: (_req, file, cb) => {
		if (!ALLOWED_MIME.includes(file.mimetype)) {
			cb(new Error("INVALID_FILE_TYPE"));
			return;
		}
		cb(null, true);
	},
}).single("photo");
