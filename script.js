document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素 ---
    const gridContainer = document.getElementById('site-grid');
    const searchInput = document.getElementById('search-input');
    const addBtn = document.getElementById('add-site-btn');
    const contextMenu = document.getElementById('context-menu');

    // Modal 元素 (网站编辑)
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const inputName = document.getElementById('site-name');
    const inputUrl = document.getElementById('site-url');
    const inputIconUrl = document.getElementById('site-icon-url');
    const inputFile = document.getElementById('site-icon-file');
    const showBorderCheckbox = document.getElementById('show-border-checkbox'); // 新增：获取复选框元素
    // const inputId = document.getElementById('site-id'); // 原代码未解构，保留引用
    const avatarPreview = document.getElementById('avatar-preview');
    // const avatarPreviewImg = document.getElementById('avatar-preview-img'); // 使用时直接获取
    const btnSave = document.getElementById('modal-save');
    const btnCancel = document.getElementById('modal-cancel');

    // Profile 元素
    const otLogoContainer = document.getElementById('opentab-logo');
    const otLogoElem = document.querySelector('.ot-logo');
    const otTextElem = document.querySelector('.ot-text');

    // Profile Modal 元素
    const profileModalOverlay = document.getElementById('profile-modal-overlay');
    const profileIconUrl = document.getElementById('profile-icon-url');
    const profileFile = document.getElementById('profile-icon-file');
    const profilePreview = document.getElementById('profile-avatar-preview');
    const profilePreviewImg = document.getElementById('profile-avatar-preview-img');
    const profileIdInput = document.getElementById('profile-id');
    const profileSaveBtn = document.getElementById('profile-modal-save');
    const profileCancelBtn = document.getElementById('profile-modal-cancel');

    // --- 状态变量 ---
    let sites = [];
    let userProfile = {}; // 新增：在内存中存储 profile 状态
    let currentEditIndex = -1; // -1 表示新增模式
    let tempBase64Icon = null; // 临时存储上传的图片 Base64
    let tempProfileBase64 = null; // 临时存储 profile 上传的 Base64
    let draggedIndex = null; // 记录正在拖拽的卡片索引

    // --- 1. 初始化数据 ---
    const defaultSites = [
        { name: 'Google', url: 'https://www.google.com', icon: '', isShowBorder: true },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '', isShowBorder: true },
        { name: 'Bilibili', url: 'https://www.bilibili.com', icon: '', isShowBorder: true },
        { name: 'Reddit', url: 'https://www.reddit.com', icon: '', isShowBorder: true },
        { name: 'Gemini', url: 'https://gemini.google.com/app?hl=zh', icon: '', isShowBorder: true },
        { name: 'Pinterest', url: 'https://www.pinterest.com', icon: '', isShowBorder: false },
        { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: '', isShowBorder: true }
    ];

    // 启动加载 (合并加载 Sites 和 Profile)
    loadData();

    function loadData() {
        // 使用 chrome.storage.local.get 读取数据
        chrome.storage.local.get(['myTabSites', 'openTabProfile'], (result) => {
            // 1. 处理 Sites
            if (result.myTabSites) {
                sites = result.myTabSites;
            } else {
                sites = defaultSites;
                // 可选：如果没有数据，写入默认值
                // chrome.storage.local.set({ myTabSites: defaultSites }); 
            }

            // 2. 处理 Profile
            if (result.openTabProfile) {
                userProfile = result.openTabProfile;
            } else {
                userProfile = {};
            }

            // 3. 渲染页面
            renderGrid();
            applyProfile(userProfile);
        });
    }

    function saveSites() {
        // 异步保存到 chrome.storage
        chrome.storage.local.set({ 'myTabSites': sites }, () => {
            renderGrid();
        });
    }
    // 辅助函数：将 URL 图片转换为 Base64
    async function urlToBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Base64转换失败:', error);
            return null;
        }
    }

    // --- 2. 渲染网格 ---
    function renderGrid() {
        gridContainer.innerHTML = '';
        sites.forEach((site, index) => {
            const card = document.createElement('div');
            card.className = 'site-card';
            card.dataset.index = index;
            card.draggable = true;

            const iconDiv = document.createElement('div');
            iconDiv.className = 'site-icon';

            const img = document.createElement('img');
            img.alt = site.name || '';

            // 1. 构建候选列表
            const googleFavicon = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
            const candidates = [];

            // 优先使用已存储的 (可能是 Base64)
            if (site.icon) candidates.push(site.icon);
            // 本地路径尝试
            if (site.icon && !site.icon.match(/^https?:|^data:|^\//)) candidates.push('./' + site.icon);
            // Google API 兜底
            candidates.push(googleFavicon);

            let tryIndex = 0;

            // 加载失败尝试下一个
            img.onerror = function () {
                tryIndex++;
                if (tryIndex < candidates.length) {
                    img.src = candidates[tryIndex];
                }
            };

            // --- 核心修改：加载成功后转 Base64 存储 ---
            img.onload = async function () {
                // 判断条件：当前显示的 src 是网络地址 (http开头)，且原本存储的不是 Base64 (data:开头)
                // 这意味着我们是从网络 (Google API 或 URL) 加载的图片，需要转换并保存
                if (img.src.startsWith('http') && (!site.icon || !site.icon.startsWith('data:'))) {

                    // 防止重复执行：如果当前 src 和 site.icon 完全一样(即只是普通URL)，也进行转换
                    // 但通常 site.icon 此时可能是空的，或者是一个失效的旧 URL

                    const base64Data = await urlToBase64(img.src);

                    if (base64Data) {
                        // 更新内存数据
                        sites[index].icon = base64Data;
                        // 异步保存到 Chrome Storage
                        chrome.storage.local.set({ 'myTabSites': sites }, () => {
                            console.log(`Base64 saved for ${site.name}`);
                        });
                    }
                }
            };

            // 启动加载
            img.src = candidates[0] || googleFavicon;

            iconDiv.appendChild(img);

            const titleDiv = document.createElement('div');
            titleDiv.className = 'site-title';
            titleDiv.textContent = site.name;
            if (site.id) titleDiv.title = site.id;

            card.appendChild(iconDiv);
            card.appendChild(titleDiv);

            if (site.isShowBorder == false) {
                iconDiv.classList.add('no-icon-bg');
                img.classList.add('icon-full-size');
            } else {
                img.classList.add('icon-with-border');
            }

            // 点击跳转
            card.addEventListener('click', () => {
                let url = site.url;
                if (!url.startsWith('http')) url = 'https://' + url;
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.update({ url: url });
                } else {
                    window.location.href = url;
                }
            });

            // 右键菜单
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, index);
            });

            // 拖拽事件
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
                card.classList.add('dragging');
                draggedIndex = index;
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                document.querySelectorAll('.site-card').forEach(c => c.classList.remove('drag-over'));
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (index !== draggedIndex) card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.remove('drag-over');
                if (index !== draggedIndex && draggedIndex !== null) {
                    [sites[draggedIndex], sites[index]] = [sites[index], sites[draggedIndex]];
                    chrome.storage.local.set({ 'myTabSites': sites }, () => renderGrid());
                }
                draggedIndex = null;
            });

            gridContainer.appendChild(card);
        });
    }

    // 记得把 urlToBase64 函数放在 renderGrid 外面或者里面都可以
    async function urlToBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn('无法转换图片为Base64 (可能是跨域限制):', url);
            return null;
        }
    }

    // --- 3. 右键菜单逻辑 ---
    function showContextMenu(x, y, index) {
        currentEditIndex = index;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    document.addEventListener('click', () => contextMenu.style.display = 'none');

    document.getElementById('menu-edit').addEventListener('click', () => {
        openModal(true);
    });

    document.getElementById('menu-delete').addEventListener('click', () => {
        if (confirm('确定删除该快捷方式吗？')) {
            sites.splice(currentEditIndex, 1);
            saveSites();
        }
    });

    // --- 4. 弹窗与添加/编辑逻辑 ---
    addBtn.addEventListener('click', () => openModal(false));

    function applyProfile(profile) {
        if (!profile) return;
        if (profile.avatar) {
            otLogoContainer.classList.add('has-avatar');
            otLogoElem.innerHTML = `<img class="ot-avatar-img" src="${profile.avatar}" />`;
        } else {
            otLogoContainer.classList.remove('has-avatar');
            otLogoElem.innerHTML = '';
        }
        otTextElem.textContent = profile.id || 'OpenTab';
    }

    // 顶部 Logo 点击：打开 Profile Modal
    if (otLogoContainer) {
        otLogoContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            // 直接使用内存中的 userProfile，无需重新读取 storage
            profileIdInput.value = userProfile.id || '';
            profilePreviewImg.src = userProfile.avatar || '';
            tempProfileBase64 = null;
            profileIconUrl.value = '';
            profileModalOverlay.classList.remove('hidden');
        });
    }

    function openModal(isEdit) {
        modalOverlay.classList.remove('hidden');
        tempBase64Icon = null;
        inputFile.value = '';

        if (isEdit && currentEditIndex > -1) {
            const site = sites[currentEditIndex];
            modalTitle.innerText = "编辑网站";
            inputName.value = site.name;
            inputUrl.value = site.url;

            if (site.icon && !site.icon.startsWith('data:')) {
                inputIconUrl.value = site.icon;
            } else {
                inputIconUrl.value = '';
            }

            const previewImg = document.getElementById('avatar-preview-img');
            if (site.icon) {
                previewImg.src = site.icon;
            } else {
                previewImg.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
            }
            
            // 添加：设置复选框状态
            showBorderCheckbox.checked = site.isShowBorder !== false;
        } else {
            modalTitle.innerText = "添加新网站";
            currentEditIndex = -1;
            inputName.value = '';
            inputUrl.value = '';
            inputIconUrl.value = '';
            document.getElementById('avatar-preview-img').src = '';
            
            // 添加：新网站默认勾选复选框
            showBorderCheckbox.checked = true;
        }
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }

    btnCancel.addEventListener('click', closeModal);

    // --- 5. 处理文件上传 (转 Base64) ---
    // 网站图标上传
    inputFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFileSelect(file, (base64) => {
            tempBase64Icon = base64;
            document.getElementById('avatar-preview-img').src = base64;
        });
    });

    // Profile 头像上传
    if (profileFile) {
        profileFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFileSelect(file, (base64) => {
                tempProfileBase64 = base64;
                profilePreviewImg.src = base64;
            });
        });
    }

    // 通用文件处理函数
    function handleFileSelect(file, callback) {
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                callback(e.target.result);
                alert("图片已选择，保存后生效");
            };
            if (file.size > 500 * 1024) {
                alert("注意：图片较大，可能占用存储空间，建议使用小图标。");
            }
            reader.readAsDataURL(file);
        }
    }

    // 点击预览图触发上传
    if (avatarPreview) {
        avatarPreview.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFile.click();
        });
    }
    if (profilePreview) {
        profilePreview.addEventListener('click', (e) => {
            e.stopPropagation();
            if (profileFile) profileFile.click();
        });
    }

    // --- 6. 保存逻辑 ---
    // 保存网站
    btnSave.addEventListener('click', () => {
        const name = inputName.value.trim();
        const url = inputUrl.value.trim();
        const iconUrl = inputIconUrl.value.trim();
        const idVal = (currentEditIndex > -1) ? (sites[currentEditIndex]?.id || '') : '';

        if (!name || !url) {
            alert('名称和网址不能为空');
            return;
        }

        let finalIcon = '';
        if (tempBase64Icon) {
            finalIcon = tempBase64Icon;
        } else if (iconUrl) {
            finalIcon = iconUrl;
        } else if (currentEditIndex > -1) {
            const oldIcon = sites[currentEditIndex].icon;
            if (oldIcon) finalIcon = oldIcon;
        }

        // 获取复选框的当前状态
        const isShowBorderVal = showBorderCheckbox.checked;
        const newSite = { name, url, icon: finalIcon, isShowBorder: isShowBorderVal, id: idVal };

        if (currentEditIndex > -1) {
            sites[currentEditIndex] = newSite;
        } else {
            sites.push(newSite);
        }

        saveSites(); // 这里的 saveSites 已经是改过后的 chrome.storage 版本
        closeModal();
    });

    // 保存 Profile
    if (profileCancelBtn) {
        profileCancelBtn.addEventListener('click', () => {
            profileModalOverlay.classList.add('hidden');
            tempProfileBase64 = null;
        });
    }

    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', () => {
            const idVal = profileIdInput.value.trim();
            const iconUrl = profileIconUrl.value.trim();
            let finalIcon = '';

            // 优先使用新上传的，其次是输入框URL，最后保持原有（如果有逻辑需要保持）
            // 这里简单逻辑：如果没传新的，且输入框没填，就看原userProfile
            if (tempProfileBase64) {
                finalIcon = tempProfileBase64;
            } else if (iconUrl) {
                finalIcon = iconUrl;
            } else {
                // 如果用户没有做任何修改，保持原头像
                finalIcon = userProfile.avatar || '';
            }

            // 更新内存变量
            userProfile = { id: idVal, avatar: finalIcon };

            // 异步保存到 chrome.storage
            chrome.storage.local.set({ 'openTabProfile': userProfile }, () => {
                applyProfile(userProfile);
                profileModalOverlay.classList.add('hidden');
                tempProfileBase64 = null;
            });
        });
    }

    // --- 7. 搜索功能 ---
    const searchForm = document.getElementById('search-form');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.update({ url: targetUrl });
                } else {
                    window.open(targetUrl);
                }
            }
        });
    }
});