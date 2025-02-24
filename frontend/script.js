document.getElementById('createFolderBtn').addEventListener('click', async () => {
    const folderName = prompt("請輸入資料夾名稱:");
    if (!folderName) return;

    try {
        const response = await fetch('/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `${currentPath}/${folderName}`.replace(/^\/+/, '').replace(/\/{2,}/g, '/') })
        });

        const result = await response.json();
        if (response.ok) {
            alert('✅ 資料夾建立成功');
            loadFileList(currentPath); // 重新載入列表
        } else {
            alert(`❌ 建立失敗: ${result.error}`);
        }
    } catch (error) {
        alert('❌ 無法建立資料夾');
    }
});

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('請選擇文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('文件上傳成功');
            loadFileList();
        } else {
            alert('文件上傳失敗');
        }
    } catch (error) {
        console.error('上傳錯誤:', error);
    }
}

let currentPath = ''; // 追蹤當前路徑

async function loadFileList(path = '') {
    try {
        path = typeof path === 'string' ? path : '';
        currentPath = path.replace(/^\/+/, '').replace(/\/{2,}/g, '/'); // 清理路徑格式

        const response = await fetch(`/files?path=${encodeURIComponent(currentPath)}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP 錯誤: ${response.status} - ${errorText}`);
        }

        const files = await response.json();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        if (path !== '') {
            const backLi = document.createElement('li');
            backLi.innerHTML = '⬅️ 返回上一層';
            backLi.style.cursor = 'pointer';
            backLi.onclick = () => {
                const parentPath = path.split('/').slice(0, -1).join('/');
                loadFileList(parentPath);
            };
            fileList.appendChild(backLi);
        }

        files.forEach(file => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.padding = '8px 12px';
            li.style.borderBottom = '1px solid #ddd';
        
            // 容器 - 放置名稱
            const fileNameDiv = document.createElement('div');
            fileNameDiv.style.flex = '1'; // 讓名稱區塊佔滿剩餘空間
        
            // 容器 - 放置按鈕
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '8px';
        
            if (file.type === 'folder') {
                // **📁 資料夾**
                fileNameDiv.innerHTML = `<strong>📁 ${file.name}</strong>`;
                li.style.cursor = 'pointer';
                li.onclick = () => loadFileList(`${path}/${file.name}`);
        
                // 重新命名按鈕
                const renameBtn = document.createElement('button');
                renameBtn.textContent = '✏️';
                renameBtn.onclick = (event) => {
                    event.stopPropagation(); // 防止點擊開啟資料夾
                    const newName = prompt("請輸入新資料夾名稱:", file.name);
                    if (newName && newName !== file.name) {
                        renameFileOrFolder(`${path}/${file.name}`, newName);
                    }
                };
        
                btnContainer.appendChild(renameBtn);
            } else {
                // **📄 檔案**
                fileNameDiv.textContent = `📄 ${file.name}`;
        
                // 預覽按鈕
                const previewBtn = document.createElement('button');
                previewBtn.textContent = '🔍';
                previewBtn.onclick = () => previewFile(`${path}/${file.name}`);
        
                // 下載按鈕
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = '⬇️';
                downloadBtn.onclick = () => downloadFile(`${path}/${file.name}`);
        
                // 重新命名按鈕
                const renameBtn = document.createElement('button');
                renameBtn.textContent = '✏️';
                renameBtn.onclick = () => {
                    const newName = prompt("請輸入新檔案名稱:", file.name);
                    if (newName && newName !== file.name) {
                        renameFileOrFolder(`${path}/${file.name}`, newName);
                    }
                };
        
                btnContainer.appendChild(previewBtn);
                btnContainer.appendChild(downloadBtn);
                btnContainer.appendChild(renameBtn);
            }
        
            // **刪除按鈕 (通用)**
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.onclick = (event) => {
                event.stopPropagation(); // 防止點擊開啟資料夾
                deleteFileOrFolder(`${path}/${file.name}`);
            };
        
            btnContainer.appendChild(deleteBtn);
            
            li.appendChild(fileNameDiv);  // 檔案名稱
            li.appendChild(btnContainer); // 按鈕區塊
            fileList.appendChild(li);
        });
        

    } catch (error) {
        console.error('❌ 獲取文件列表失敗:', error);
        alert(`無法載入文件列表: ${error.message}`);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const fileList = document.getElementById("file-list");
    const uploadForm = document.getElementById("upload-form");
    const fileInput = document.getElementById("file-input");
    const currentPath = document.getElementById("current-path");

    let path = "";

    function fetchFiles() {
        fetch(`/files?path=${path}`)
            .then(response => response.json())
            .then(files => {
                fileList.innerHTML = "";
                currentPath.textContent = `Current Directory: /${path}`;
                
                if (path) {
                    const backItem = document.createElement("li");
                    backItem.innerHTML = `<button class="folder" data-path="">⬆ Back</button>`;
                    fileList.appendChild(backItem);
                }
                
                files.forEach(file => {
                    const item = document.createElement("li");
                    if (file.type === "folder") {
                        item.innerHTML = `<button class="folder" data-path="${file.path}">📁 ${file.name}</button>
                                          <button class="rename" data-path="${file.path}" data-name="${file.name}">✏️</button>`;
                    } else {
                        item.innerHTML = `<span>${file.name}</span>
                            <a href="/download${file.path}" class="download">⬇</a>
                            <button class="rename" data-path="${file.path}" data-name="${file.name}">✏️</button>
                            <button class="delete" data-path="${file.path}">❌</button>`;
                    }
                    fileList.appendChild(item);
                });
                
            });
    }
    
    uploadForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        fetch("/upload", {
            method: "POST",
            body: formData
        }).then(() => {
            fetchFiles();
            fileInput.value = "";
        });
    });

    fileList.addEventListener("click", function (e) {
        if (e.target.classList.contains("folder")) {
            path = e.target.dataset.path;
            fetchFiles();
        } else if (e.target.classList.contains("delete")) {
            if (confirm("確定要刪除嗎？")) {
                fetch(`/files${e.target.dataset.path}`, { method: "DELETE" })
                    .then(() => fetchFiles());
            }
        } else if (e.target.classList.contains("rename")) {
            const oldName = e.target.dataset.name;
            const oldPath = e.target.dataset.path;
            const newName = prompt("請輸入新名稱:", oldName);

            if (newName && newName !== oldName) {
                renameFileOrFolder(oldPath, newName);
            }
        }
    });

    function renameFileOrFolder(oldPath, newName) {
        fetch("/rename", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldPath, newPath: `${path}/${newName}` })
        })
        .then(response => response.json())
        .then(result => {
            if (result.error) {
                alert(`❌ 重命名失敗: ${result.error}`);
            } else {
                alert("✅ 重命名成功");
                fetchFiles();
            }
        })
        .catch(error => {
            alert("❌ 發生錯誤: " + error.message);
        });
    }

    fetchFiles();
});


async function previewFile(filePath) {
    console.log("📂 預覽文件:", filePath);
    
    const fileExt = filePath.split('.').pop().toLowerCase();
    const previewUrl = `/uploads/${encodeURIComponent(filePath)}`; // 修正路徑

    // 創建預覽視窗
    const previewWindow = window.open("", "_blank", "width=800,height=600");
    previewWindow.document.write(`<h2>正在載入預覽...</h2>`);

    if (['png', 'jpg', 'jpeg', 'gif'].includes(fileExt)) {
        previewWindow.document.body.innerHTML = `<img src="${previewUrl}" style="max-width:100%;">`;
    } else if (['mp4', 'webm', 'ogg'].includes(fileExt)) {
        previewWindow.document.body.innerHTML = `
            <video id="previewVideo" controls autoplay style="max-width:100%;">
                <source src="${previewUrl}" type="video/${fileExt === 'ogg' ? 'ogg' : 'mp4'}">
                瀏覽器不支援此影片格式
            </video>`;
    } else if (fileExt === 'wmv') {
        try {
            const response = await fetch(`/convert?file=${encodeURIComponent(filePath)}`);
            const data = await response.json();
            if (response.ok && data.url) {
                previewWindow.document.body.innerHTML = `
                    <video id="previewVideo" controls autoplay style="max-width:100%;">
                        <source src="${data.url}" type="video/mp4">
                        瀏覽器不支援 MP4 影片
                    </video>`;
            } else {
                previewWindow.document.body.innerHTML = `<p style="color:red;">❌ 預覽失敗: ${data.error || '未知錯誤'}</p>`;
            }
        } catch (error) {
            previewWindow.document.body.innerHTML = `<p style="color:red;">❌ 發生錯誤: ${error.message}</p>`;
        }
    } else if (fileExt === 'pdf') {
        previewWindow.document.body.innerHTML = `<embed src="${previewUrl}" type="application/pdf" width="100%" height="100%">`;
    } else if (['txt', 'log', 'json', 'js', 'css', 'html'].includes(fileExt)) {
        try {
            const response = await fetch(previewUrl);
            const text = await response.text();
            previewWindow.document.body.innerHTML = `<pre style="white-space:pre-wrap; word-wrap:break-word;">${text}</pre>`;
        } catch (error) {
            previewWindow.document.body.innerHTML = `<p style="color:red;">❌ 無法預覽此文件</p>`;
        }
    } else {
        previewWindow.document.body.innerHTML = `<p>❌ 無法預覽此類型的文件</p>`;
    }
}

async function deleteFileOrFolder(filePath) {
    if (!confirm(`確定要刪除 "${filePath}" 嗎？`)) return;

    try {
        const response = await fetch(`/files/${encodeURIComponent(filePath)}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (response.ok) {
            alert('✅ 刪除成功');
            loadFileList(currentPath); // 重新載入文件列表
        } else {
            alert(`❌ 刪除失敗: ${result.error}`);
        }
    } catch (error) {
        alert('❌ 無法刪除文件');
    }
}

function downloadFile(filePath) {
    const link = document.createElement('a');
    link.href = `/download/${encodeURIComponent(filePath)}`;
    link.setAttribute('download', filePath.split('/').pop()); // 設定下載的檔名
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
    loadFileList(); // 載入文件列表
});
