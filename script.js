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
        { name: 'Google', url: 'https://www.google.com', icon: '' }, // 空 icon 会自动抓取
        { name: 'GitHub', url: 'https://github.com', icon: '' }
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
            let iconSrc = site.icon;
            if (!iconSrc) {
                iconSrc = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
            }

            card.innerHTML = `
                <div class="site-icon">
                    <img src="${iconSrc}" alt="${site.name}">
                </div>
                <div class="site-title">${site.name}</div>
            `;

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
    // addBtn.addEventListener('click', () => openModal(false));

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
            reader.onload = function(e) {
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
             if(oldIcon) finalIcon = oldIcon;
        }

        const newSite = { name, url, icon: finalIcon };

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

    document.addEventListener('DOMContentLoaded', () => {
    // ... 前面的代码不变 ...

    // === 新的搜索逻辑 (替换原来的 searchInput.addEventListener) ===
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            // 1. 阻止表单默认的刷新页面行为
            e.preventDefault();
            
            // 2. 获取输入内容
            const query = searchInput.value.trim();
            
            console.log(query)
            // 3. 执行跳转
            // if (query) {
            //     window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            // }
        });
    } else {
        console.error("找不到搜索表单，请检查 HTML id='search-form' 是否存在");
    }

    // ... 其他代码不变 ...
});
});