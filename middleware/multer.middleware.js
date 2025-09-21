// middleware/multer.middleware.js
import multer from "multer";
import path from "path";

const storage = multer.memoryStorage(); // no destination/filename here

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  if (!allowed.includes(ext))
    return cb(new Error("Only images allowed!"), false);
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

export default upload;
