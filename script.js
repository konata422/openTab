document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const gridContainer = document.getElementById('site-grid');
    const searchInput = document.getElementById('search-input');
    const addBtn = document.getElementById('add-site-btn');
    const contextMenu = document.getElementById('context-menu');

    // Modal 元素
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const inputName = document.getElementById('site-name');
    const inputUrl = document.getElementById('site-url');
    const inputIconUrl = document.getElementById('site-icon-url');
    const inputFile = document.getElementById('site-icon-file');
    const btnSave = document.getElementById('modal-save');
    const btnCancel = document.getElementById('modal-cancel');

    // 状态变量
    let sites = [];
    let currentEditIndex = -1; // -1 表示新增模式
    let tempBase64Icon = null; // 临时存储上传的图片 Base64

    // 1. 初始化数据
    const defaultSites = [
        { name: 'Google', url: 'https://www.google.com', icon: 'icon/google.png', isShowBorder: true },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: 'icon/youtube.png', isShowBorder: true },
        { name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'icon/bilibili.svg', isShowBorder: true },
        { name: 'Reddit', url: 'https://www.reddit.com', icon: 'icon/reddit.png', isShowBorder: true },
        { name: 'Gemini', url: 'https://gemini.google.com/app?hl=zh', icon: 'icon/gemini.png', isShowBorder: true },
        { name: 'Pinterest', url: 'https://www.pinterest.com', icon: 'icon/pinterest.png', isShowBorder: false },
        { name:'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'icon/deepseek.png', isShowBorder: true }
    ];
    

    // 加载数据
    loadSites();

    function loadSites() {
        const stored = localStorage.getItem('myTabSites');
        sites = stored ? JSON.parse(stored) : defaultSites;        
        renderGrid();
    }

    function saveSites() {
        localStorage.setItem('myTabSites', JSON.stringify(sites));
        renderGrid();
    }

    // 2. 渲染网格
    function renderGrid() {
        gridContainer.innerHTML = '';
        sites.forEach((site, index) => {
            const card = document.createElement('div'); // 改为 div 以便处理点击事件
            card.className = 'site-card';
            card.dataset.index = index; // 绑定索引

            // 图标逻辑：优先使用自定义 Base64/URL，否则使用 Google Favicon API
            const googleFavicon = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;

            // 创建元素而非直接 innerHTML，以便添加错误回退逻辑
            const iconDiv = document.createElement('div');
            iconDiv.className = 'site-icon';

            const img = document.createElement('img');
            img.alt = site.name || '';

            // 构建候选 src 列表，包含常见的相对路径变体，最后回退到 Google Favicon
            const candidates = [];
            if (site.icon) candidates.push(site.icon);
            // 如果用户用的是 `icon/`，尝试 `icons/`，反之亦然
            if (site.icon && site.icon.startsWith('icon/')) candidates.push(site.icon.replace(/^icon\//, 'icons/'));
            if (site.icon && site.icon.startsWith('icons/')) candidates.push(site.icon.replace(/^icons\//, 'icon/'));
            // 相对路径可能需要 ./ 前缀
            if (site.icon && !site.icon.match(/^https?:|^data:|^\//)) candidates.push('./' + site.icon);
            // 最后回退到 Google 提取的 favicon
            candidates.push(googleFavicon);

            let tryIndex = 0;
            img.onerror = function () {
                tryIndex++;
                if (tryIndex < candidates.length) {
                    img.src = candidates[tryIndex];
                }
            };

            // 开始尝试第一个候选
            img.src = candidates[0] || googleFavicon;
            iconDiv.appendChild(img);

            const titleDiv = document.createElement('div');
            titleDiv.className = 'site-title';
            titleDiv.textContent = site.name;

            card.appendChild(iconDiv);
            card.appendChild(titleDiv);

            console.log('Rendering site:', site,site.isShowBorder);

            // 根据 isShowBorder 决定是否显示图标容器的背景/阴影，以及图标的宽高
            if (site.isShowBorder == false) {
                iconDiv.classList.add('no-icon-bg');
                img.classList.add('icon-full-size');
            } else {
                img.classList.add('icon-with-border');
            }

            // 左键点击跳转
            card.addEventListener('click', () => {
                let url = site.url;
                if (!url.startsWith('http')) url = 'https://' + url;
                window.location.href = url;
            });

            // 右键点击触发菜单
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, index);
            });

            gridContainer.appendChild(card);
        });
    }

    // 3. 右键菜单逻辑
    function showContextMenu(x, y, index) {
        currentEditIndex = index;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    // 点击其他地方关闭菜单
    document.addEventListener('click', () => contextMenu.style.display = 'none');

    // 菜单操作
    document.getElementById('menu-edit').addEventListener('click', () => {
        openModal(true);
    });

    document.getElementById('menu-delete').addEventListener('click', () => {
        if (confirm('确定删除该快捷方式吗？')) {
            sites.splice(currentEditIndex, 1);
            saveSites();
        }
    });

    // 4. 弹窗与添加/编辑逻辑
    addBtn.addEventListener('click', () => openModal(false));

    function openModal(isEdit) {
        modalOverlay.classList.remove('hidden');
        tempBase64Icon = null; // 重置临时图片
        inputFile.value = ''; // 清空文件选择

        if (isEdit && currentEditIndex > -1) {
            const site = sites[currentEditIndex];
            modalTitle.innerText = "编辑网站";
            inputName.value = site.name;
            inputUrl.value = site.url;

            // 判断当前 icon 是 URL 还是 Base64
            if (site.icon && !site.icon.startsWith('data:')) {
                inputIconUrl.value = site.icon;
            } else {
                inputIconUrl.value = '';
            }
        } else {
            modalTitle.innerText = "添加新网站";
            currentEditIndex = -1;
            inputName.value = '';
            inputUrl.value = '';
            inputIconUrl.value = '';
        }
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }

    btnCancel.addEventListener('click', closeModal);

    // 5. 处理文件上传 (转 Base64)
    inputFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                tempBase64Icon = e.target.result; // 保存 Base64 字符串
                // 可以在这里做一个小的预览逻辑，如果需要的话
                alert("图片已选择，保存后生效");
            };
            // 限制大小提示
            if (file.size > 500 * 1024) { // 大于 500KB
                alert("注意：图片较大，可能占用存储空间，建议使用小图标。");
            }
            reader.readAsDataURL(file);
        }
    });

    // 6. 保存逻辑
    btnSave.addEventListener('click', () => {
        const name = inputName.value.trim();
        const url = inputUrl.value.trim();
        const iconUrl = inputIconUrl.value.trim();

        if (!name || !url) {
            alert('名称和网址不能为空');
            return;
        }

        // 确定最终图标
        // 优先级：上传的图片 > 手填的URL链接 > 空(使用默认API)
        let finalIcon = '';
        if (tempBase64Icon) {
            finalIcon = tempBase64Icon;
        } else if (iconUrl) {
            finalIcon = iconUrl;
        } else if (currentEditIndex > -1) {
            // 如果是编辑模式，且没做修改，保持原样（如果原来是Base64，这里要小心不要覆盖）
            const oldIcon = sites[currentEditIndex].icon;
            // 如果没上传新图，也没填新URL，且本来就有图，则保留原图
            if (oldIcon) finalIcon = oldIcon;
        }

        // 新增/编辑时保留原有的 isShowBorder 值（编辑模式）或默认 true（新增）
        const isShowBorderVal = (currentEditIndex > -1) ? (sites[currentEditIndex]?.isShowBorder ?? true) : true;
        const newSite = { name, url, icon: finalIcon, isShowBorder: isShowBorderVal };

        if (currentEditIndex > -1) {
            // 编辑
            sites[currentEditIndex] = newSite;
        } else {
            // 新增
            sites.push(newSite);
        }

        saveSites();
        closeModal();
    });

    const searchForm = document.getElementById('search-form');
    // const searchInputBox = document.getElementById('search-input');

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            // 1. 必须阻止默认提交行为
            e.preventDefault();

            const query = searchInput.value.trim();
            if (query) {
                // 2. 构造搜索 URL
                const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

                // 3. 核心修复：使用 Chrome 扩展专用 API 跳转
                // 这能绕过几乎所有 window.location 的权限限制
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.update({ url: targetUrl });
                } else {
                    // 兜底方案
                    window.open(targetUrl);
                }
            }
        });
    }
});