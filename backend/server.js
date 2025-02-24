const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, 'temp');

// 確保 uploads 目錄存在
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 設定 Multer 儲存檔案方式
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 讓 Express 提供前端的靜態文件
app.use(express.static(path.join(__dirname, '../frontend')));

// 讓 Express 提供 uploads 內的文件
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/temp', express.static(TEMP_DIR));

// 遞歸獲取目錄內的文件和資料夾
function getFilesRecursive(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            results.push({
                name: file,
                path: filePath.replace(UPLOAD_DIR, ''), 
                type: 'folder'
            });
        } else {
            results.push({
                name: file,
                path: filePath.replace(UPLOAD_DIR, ''), 
                type: 'file'
            });
        }
    });
    return results;
}

// 下載文件或資料夾
app.get('/download/*', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params[0]);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: '文件或資料夾不存在' });
    }
});

// 取得文件列表
app.get('/files', (req, res) => {
    try {
        const requestedPath = req.query.path || '';
        let safePath = requestedPath.replace(/^\/+/, '').replace(/\.\./g, '');
        const targetDir = path.join(UPLOAD_DIR, safePath);

        if (!targetDir.startsWith(UPLOAD_DIR)) {
            return res.status(400).json({ error: '無效的目錄請求' });
        }
        if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
            return res.status(404).json({ error: '目錄不存在' });
        }

        const files = getFilesRecursive(targetDir);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: '無法讀取文件' });
    }
});

// 上傳文件
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ message: '文件上傳成功', filename: req.file.originalname });
});

// 刪除文件或資料夾
app.delete("/files/:filePath", async (req, res) => {
    const filePath = path.join(__dirname, "uploads", req.params.filePath);

    fs.stat(filePath, (err, stats) => {
        if (err) return res.status(400).json({ error: "文件不存在" });

        if (stats.isDirectory()) {
            // ⚠️ 改用 `fs.rm` 來刪除資料夾
            fs.rm(filePath, { recursive: true, force: true }, (err) => {
                if (err) return res.status(500).json({ error: "刪除資料夾失敗" });
                res.json({ success: true });
            });
        } else {
            fs.unlink(filePath, (err) => {
                if (err) return res.status(500).json({ error: "刪除文件失敗" });
                res.json({ success: true });
            });
        }
    });
});

// 建立資料夾
app.post('/mkdir', (req, res) => {
    const folderName = req.body.path;
    if (!folderName) {
        return res.status(400).json({ error: '請提供資料夾名稱' });
    }

    const sanitizedPath = folderName.replace(/^\/+|\/+$/g, '').replace(/\.\./g, ''); // 避免路徑攻擊
    const fullPath = path.join(UPLOAD_DIR, sanitizedPath);

    try {
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            res.json({ message: '資料夾建立成功' });
        } else {
            res.status(400).json({ error: '資料夾已存在' });
        }
    } catch (error) {
        console.error('❌ 建立資料夾失敗:', error);
        res.status(500).json({ error: '無法建立資料夾' });
    }
});

app.put('/rename', (req, res) => {
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
        return res.status(400).json({ error: '請提供舊名稱和新名稱' });
    }

    // 移除開頭和結尾的 "/"，防止路徑跳躍
    const sanitizedOldPath = oldPath.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
    const sanitizedNewPath = newPath.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');

    const oldFullPath = path.join(UPLOAD_DIR, sanitizedOldPath);
    const newFullPath = path.join(UPLOAD_DIR, sanitizedNewPath);

    // 檢查舊文件/資料夾是否存在
    if (!fs.existsSync(oldFullPath)) {
        return res.status(404).json({ error: '文件或資料夾不存在' });
    }

    // 檢查新名稱是否已經存在，避免覆蓋
    if (fs.existsSync(newFullPath)) {
        return res.status(400).json({ error: '新名稱已存在' });
    }

    // 檢查是否跨資料夾重命名
    const oldDir = path.dirname(oldFullPath);
    const newDir = path.dirname(newFullPath);

    if (oldDir !== newDir) {
        return res.status(400).json({ error: '不允許跨資料夾重命名' });
    }

    try {
        fs.renameSync(oldFullPath, newFullPath);
        res.json({ message: '名稱變更成功' });
    } catch (error) {
        console.error('❌ 變更名稱失敗:', error);
        res.status(500).json({ error: '無法變更名稱' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`NAS is working on http://localhost:${PORT}`);
});