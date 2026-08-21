document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素 ---
    const gridContainer = document.getElementById('site-grid');
    const searchInput = document.getElementById('search-input');
    const addBtn = document.getElementById('add-site-btn');
    const contextMenu = document.getElementById('context-menu');
    const colorSchemeMedia = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    // Modal 元素 (网站编辑)
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const inputName = document.getElementById('site-name');
    const inputUrl = document.getElementById('site-url');
    const inputIconUrl = document.getElementById('site-icon-url');
    const inputDarkIconUrl = document.getElementById('site-dark-icon-url'); // 新增：暗色图标输入框
    const inputFile = document.getElementById('site-icon-file');
    const showBorderCheckbox = document.getElementById('show-border-checkbox');
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
        { name: 'Google', url: 'https://www.google.com', icon: '', darkicon: '', isShowBorder: true },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '', darkicon: '', isShowBorder: true },
        { name: 'Bilibili', url: 'https://www.bilibili.com', icon: '', darkicon: '', isShowBorder: true },
        { name: 'Reddit', url: 'https://www.reddit.com', icon: '', darkicon: '', isShowBorder: true },
        { name: 'Gemini', url: 'https://gemini.google.com/app?hl=zh', icon: '', darkicon: '', isShowBorder: true },
        { name: 'Pinterest', url: 'https://www.pinterest.com', icon: '', darkicon: '', isShowBorder: false },
        { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: '', darkicon: '', isShowBorder: true }
    ];

    // 启动加载 (合并加载 Sites 和 Profile)
    loadData();

    // 初始：先把 logo、搜索 框和网格隐藏（通过类控制可见性），等内容准备好一次性显示
    const searchBoxElem = document.querySelector('.search-box');
    const toggleElements = [otLogoContainer, searchBoxElem, gridContainer];
    toggleElements.forEach(el => { if (el) el.classList.add('invisible'); });

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
        const frag = document.createDocumentFragment();
        const loadPromises = [];

        sites.forEach((site, index) => {
            const card = document.createElement('div');
            card.className = 'site-card';
            card.dataset.index = index;
            card.draggable = true;

            const iconDiv = document.createElement('div');
            iconDiv.className = 'site-icon';

            const img = document.createElement('img');
            img.alt = site.name || '';

            // 检测当前是否为暗色模式
            const isDarkMode = colorSchemeMedia ? colorSchemeMedia.matches : false;
            
            // 1. 构建候选列表 - 根据当前主题模式决定优先级
            const googleFavicon = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
            const candidates = [];

            // 根据当前主题模式决定使用哪个字段作为首选
            if (isDarkMode) {
                if (site.darkicon) candidates.push(site.darkicon);
                if (site.icon && site.icon !== site.darkicon) candidates.push(site.icon);
            } else {
                if (site.icon) candidates.push(site.icon);
                if (site.darkicon && site.darkicon !== site.icon) candidates.push(site.darkicon);
            }
            if (candidates.length === 0) candidates.push(googleFavicon);

            let tryIndex = 0;

            const p = new Promise((resolve) => {
                img.onerror = function () {
                    tryIndex++;
                    if (tryIndex < candidates.length) {
                        img.src = candidates[tryIndex];
                    } else {
                        resolve();
                    }
                };

                img.onload = async function () {
                    resolve();
                    try {
                        const originalIconValue = sites[index].icon;
                        const originalDarkIconValue = sites[index].darkicon;
                        if (img.src.startsWith('http') && 
                            !(originalIconValue && originalIconValue.startsWith('data:')) &&
                            !(originalDarkIconValue && originalDarkIconValue.startsWith('data:'))) {
                            const base64Data = await urlToBase64(img.src);
                            if (base64Data) {
                                sites[index].icon = base64Data;
                                chrome.storage.local.set({ 'myTabSites': sites });
                            }
                        }
                    } catch (e) { }
                };
            });

            img.src = candidates[0] || googleFavicon;
            loadPromises.push(p);
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

            frag.appendChild(card);
        });

        gridContainer.appendChild(frag);

        const timeout = new Promise(res => setTimeout(res, 500));
        Promise.race([Promise.all(loadPromises), timeout]).then(() => {
            try { toggleElements.forEach(el => { if (el) { el.classList.remove('invisible'); el.classList.add('visible'); } }); } catch(e){}
        });
    }

    // 系统主题变化时立即重新选择浅色/深色图标，无需刷新新标签页。
    if (colorSchemeMedia) {
        const handleColorSchemeChange = () => renderGrid();

        if (typeof colorSchemeMedia.addEventListener === 'function') {
            colorSchemeMedia.addEventListener('change', handleColorSchemeChange);
        } else if (typeof colorSchemeMedia.addListener === 'function') {
            // 兼容仍使用旧版 MediaQueryList API 的浏览器。
            colorSchemeMedia.addListener(handleColorSchemeChange);
        }
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
        tempBase64DarkIcon = null; // 新增：重置暗色图标临时变量
        inputFile.value = '';
        // 新增：重置暗色图标文件输入
        const inputDarkFile = document.getElementById('site-dark-icon-file');
        if (inputDarkFile) inputDarkFile.value = '';

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
            
            // 新增：设置暗色图标输入框值
            if (site.darkicon && !site.darkicon.startsWith('data:')) {
                inputDarkIconUrl.value = site.darkicon;
            } else {
                inputDarkIconUrl.value = '';
            }

            const previewImg = document.getElementById('avatar-preview-img');
            const darkPreviewImg = document.getElementById('dark-avatar-preview-img');
            // 修改：分别设置亮色和暗色预览
            if (site.icon) {
                previewImg.src = site.icon;
            } else {
                previewImg.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
            }
            
            // 修改：仅当 darkicon 存在时才设置预览图，否则设为空
            if (site.darkicon) {
                darkPreviewImg.src = site.darkicon;
            } else {
                darkPreviewImg.src = ''; // 保持为空
            }
            
            // 添加：设置复选框状态
            showBorderCheckbox.checked = site.isShowBorder !== false;
        } else {
            modalTitle.innerText = "添加新网站";
            currentEditIndex = -1;
            inputName.value = '';
            inputUrl.value = '';
            inputIconUrl.value = '';
            inputDarkIconUrl.value = ''; // 新增：重置暗色图标输入框
            document.getElementById('avatar-preview-img').src = '';
            document.getElementById('dark-avatar-preview-img').src = '';
            
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

    // 新增：暗色图标上传
    const inputDarkFile = document.getElementById('site-dark-icon-file');
    let tempBase64DarkIcon = null; // 新增：临时存储暗色图标 Base64
    if (inputDarkFile) {
        inputDarkFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFileSelect(file, (base64) => {
                tempBase64DarkIcon = base64; // 存储到临时变量
                document.getElementById('dark-avatar-preview-img').src = base64;
            });
        });
    }

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
    
    // 新增：点击暗色预览图触发上传
    const darkAvatarPreview = document.getElementById('dark-avatar-preview');
    if (darkAvatarPreview) {
        darkAvatarPreview.addEventListener('click', (e) => {
            e.stopPropagation();
            const inputDarkFile = document.getElementById('site-dark-icon-file');
            if (inputDarkFile) inputDarkFile.click();
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
        const darkIconUrl = inputDarkIconUrl.value.trim(); // 新增：获取暗色图标URL
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
        
        // 新增：处理暗色图标
        let finalDarkIcon = '';
        if (tempBase64DarkIcon) { // 优先使用上传的文件
            finalDarkIcon = tempBase64DarkIcon;
        } else if (darkIconUrl) {
            finalDarkIcon = darkIconUrl;
        } else if (currentEditIndex > -1) {
            const oldDarkIcon = sites[currentEditIndex].darkicon;
            if (oldDarkIcon) finalDarkIcon = oldDarkIcon;
        }

        // 获取复选框的当前状态
        const isShowBorderVal = showBorderCheckbox.checked;
        const newSite = { 
            name, 
            url, 
            icon: finalIcon, 
            darkicon: finalDarkIcon, // 新增：保存暗色图标
            isShowBorder: isShowBorderVal, 
            id: idVal 
        };

        if (currentEditIndex > -1) {
            sites[currentEditIndex] = newSite;
        } else {
            sites.push(newSite);
        }

        saveSites();
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
    function resolveSearchTarget(query) {
        const value = (query || '').trim();
        if (!value) return null;

        const specialMatch = value.match(/^-(g|w)\s+(.+)$/i);
        if (specialMatch) {
            const engine = specialMatch[1].toLowerCase();
            const keyword = specialMatch[2].trim();
            if (!keyword) return null;

            if (engine === 'g') {
                return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
            }
            return `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(keyword)}`;
        }

        return `https://www.bing.com/search?q=${encodeURIComponent(value)}`;
    }

    const searchForm = document.getElementById('search-form');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const targetUrl = resolveSearchTarget(searchInput.value);
            if (targetUrl) {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.update({ url: targetUrl });
                } else {
                    window.open(targetUrl, '_self');
                }
            }
        });
    }

    // --- 8. 收藏夹检索与键盘导航 ---
    const bookmarkResults = document.getElementById('bookmark-results');
    let bookmarkMatches = [];
    let bookmarkSelected = -1;
    let bookmarkDebounceTimer = null;

    function hasBookmarksPermission(callback) {
        if (chrome.permissions && chrome.permissions.contains) {
            chrome.permissions.contains({ permissions: ['bookmarks'] }, (granted) => {
                callback(granted);
            });
        } else {
            callback(false);
        }
    }

    function requestBookmarksPermission() {
        if (chrome.permissions && chrome.permissions.request) {
            chrome.permissions.request({ permissions: ['bookmarks'] }, (granted) => {
                if (granted) {
                    // re-run search if there is a query
                    performBookmarkSearch(searchInput.value.trim());
                } else {
                    renderAuthPrompt();
                }
            });
        } else {
            alert('请求收藏夹权限失败。');
        }
    }

    function renderAuthPrompt() {
        bookmarkResults.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'bookmark-auth';
        div.innerHTML = `<div>需要授权访问收藏夹以检索本地书签</div>`;
        const btn = document.createElement('button');
        btn.textContent = '允许访问收藏夹';
        btn.addEventListener('click', () => requestBookmarksPermission());
        div.appendChild(btn);
        bookmarkResults.appendChild(div);
        showBookmarkResults();
    }

    function performBookmarkSearch(query) {
        if (!query) {
            hideBookmarkResults();
            return;
        }
        hasBookmarksPermission((granted) => {
            if (!granted) {
                renderAuthPrompt();
                return;
            }

            try {
                chrome.bookmarks.search(query, (results) => {
                    // 仅根据标题匹配（忽略 URL），并跳过文件夹
                    const qLower = query.toLowerCase();
                    const filtered = (results || [])
                        .filter(r => r.url && r.title && r.title.toLowerCase().includes(qLower))
                        .sort((a, b) => {
                            const aTitle = a.title || '';
                            const bTitle = b.title || '';
                            const aIdx = aTitle.toLowerCase().indexOf(qLower);
                            const bIdx = bTitle.toLowerCase().indexOf(qLower);
                            if (aIdx !== bIdx) return aIdx - bIdx; // 首次出现位置靠前的排前
                            const lenDiff = aTitle.length - bTitle.length;
                            if (lenDiff !== 0) return lenDiff; // 标题更短的排前
                            return aTitle.localeCompare(bTitle);
                        })
                        .slice(0, 6);
                    bookmarkMatches = filtered;
                    bookmarkSelected = -1;
                    renderBookmarkMatches();
                });
            } catch (e) {
                console.warn('bookmark search error', e);
                hideBookmarkResults();
            }
        });
    }

    function renderBookmarkMatches() {
        bookmarkResults.innerHTML = '';
        if (!bookmarkMatches || bookmarkMatches.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'bookmark-item';
            empty.textContent = '未找到匹配的收藏夹';
            bookmarkResults.appendChild(empty);
            showBookmarkResults();
            return;
        }

        bookmarkMatches.forEach((b, idx) => {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.dataset.index = idx;

            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.innerHTML = `<div style="font-weight:600">${b.title || b.url}</div><div style="font-size:12px;opacity:0.7">${b.url || ''}</div>`;

            item.appendChild(meta);

            item.addEventListener('click', (e) => {
                openBookmark(b);
            });

            bookmarkResults.appendChild(item);
        });

        showBookmarkResults();
    }

    function showBookmarkResults() {
        bookmarkResults.classList.remove('hidden');
        bookmarkResults.setAttribute('aria-hidden', 'false');
    }

    function hideBookmarkResults() {
        bookmarkResults.classList.add('hidden');
        bookmarkResults.setAttribute('aria-hidden', 'true');
    }

    function updateSelection() {
        const items = bookmarkResults.querySelectorAll('.bookmark-item');
        items.forEach(it => it.classList.remove('selected'));
        if (bookmarkSelected >= 0 && items[bookmarkSelected]) {
            items[bookmarkSelected].classList.add('selected');
            // ensure visible
            items[bookmarkSelected].scrollIntoView({ block: 'nearest' });
        }
    }

    function openBookmark(b) {
        if (!b || !b.url) return;
        let url = b.url;
        if (!url.startsWith('http')) url = 'https://' + url;
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.update({ url: url });
        } else {
            window.open(url, '_self');
        }
    }

    // 事件：输入时触发检索（防抖处理），仅当输入以 '/' 开头时检索书签
    searchInput.addEventListener('input', (e) => {
        const raw = e.target.value || '';
        const trimmedRaw = raw.trim();

        if (/^-(g|w)(\s|$)/i.test(trimmedRaw) || raw.startsWith('/')) {
            if (raw.startsWith('/')) {
                const q = raw.slice(1).trim();
                if (bookmarkDebounceTimer) clearTimeout(bookmarkDebounceTimer);
                bookmarkDebounceTimer = setTimeout(() => {
                    if (!q) { hideBookmarkResults(); return; }
                    performBookmarkSearch(q);
                }, 260);
            } else {
                hideBookmarkResults();
            }
            return;
        }

        hideBookmarkResults();
    });

    // 键盘导航
    searchInput.addEventListener('keydown', (e) => {
        const key = e.key;
        if (bookmarkResults.classList.contains('hidden')) return;
        if (key === 'ArrowDown') {
            e.preventDefault();
            if (bookmarkMatches.length === 0) return;
            bookmarkSelected = Math.min(bookmarkSelected + 1, bookmarkMatches.length - 1);
            updateSelection();
        } else if (key === 'ArrowUp') {
            e.preventDefault();
            if (bookmarkMatches.length === 0) return;
            bookmarkSelected = Math.max(bookmarkSelected - 1, 0);
            updateSelection();
        } else if (key === 'Enter') {
            if (bookmarkSelected >= 0 && bookmarkMatches[bookmarkSelected]) {
                e.preventDefault();
                openBookmark(bookmarkMatches[bookmarkSelected]);
            }
        } else if (key === 'Escape') {
            hideBookmarkResults();
        }
    });

    // 点击页面任意处隐藏
    document.addEventListener('click', (e) => {
        if (!bookmarkResults.contains(e.target) && e.target !== searchInput) {
            hideBookmarkResults();
        }
    });
});