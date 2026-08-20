window.__ModuleLoader__.load({
  id: 'dsh-ds-attach',
  factory: (require) => {
    const React = require('react');
    const {
      useState, useEffect, useRef, useCallback, createElement: h
    } = React;

    // #region upload button icon — DSH's own IconPaperclipOutline16
    // Exact path from @deepseek-ai/dsh-client-ui-primitives (the icon
    // dsh-files uses); renders as a proper paperclip outline.
    const UploadIcon = () => h('svg', {
      width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { display: 'block' }
    }, h('path', {
      d: 'M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4H13.9502V9.75C13.9502 13.0361 11.2861 15.7002 8 15.7002C4.71391 15.7002 2.0498 13.0361 2.0498 9.75V4.5C2.04981 2.1804 3.9304 0.299806 6.25 0.299805C8.5696 0.299805 10.4502 2.1804 10.4502 4.5V9.75C10.4502 11.1031 9.3531 12.2002 8 12.2002C6.6469 12.2002 5.5498 11.1031 5.5498 9.75Z',
      fill: 'currentColor'
    }));

    // #region DS-chat official file-type icons (28x28 colored doc icons)
    // Base document shape: rounded doc with folded corner, colored fill.
    function DocIconBase({ color, children }) {
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: '28', height: '28', viewBox: '0 0 28 28', fill: 'none', style: { display: 'block' }
      },
        h('path', {
          d: 'M8.48924 28H19.5108C21.6479 28 22.7165 28 23.5594 27.6509C24.6833 27.1853 25.5762 26.2924 26.0417 25.1685C26.3909 24.3256 26.3909 23.257 26.3909 21.1199V8.79443C26.3909 8.32877 26.3909 8.09593 26.3471 7.87507C26.2887 7.58058 26.173 7.30042 26.0067 7.05048C25.882 6.86303 25.7177 6.69799 25.3893 6.36792L20.0611 1.01354C19.7304 0.681235 19.5651 0.515081 19.3769 0.38885C19.126 0.220541 18.8443 0.103463 18.5481 0.0443412C18.3259 0 18.0915 0 17.6226 0H8.48924C6.35209 0 5.28351 0 4.4406 0.349145C3.31672 0.814671 2.4238 1.70759 1.95828 2.83147C1.60913 3.67438 1.60913 4.74296 1.60913 6.88011V21.1199C1.60913 23.257 1.60913 24.3256 1.95828 25.1685C2.4238 26.2924 3.31672 27.1853 4.4406 27.6509C5.28351 28 6.35209 28 8.48924 28Z',
          fill: color
        }),
        h('path', {
          d: 'M26.3909 7.37445L19.0525 0V3.77445C19.0525 4.89271 19.0525 5.45184 19.2352 5.89289C19.4788 6.48096 19.946 6.94818 20.5341 7.19176C20.9751 7.37445 21.5342 7.37445 22.6525 7.37445H26.3909Z',
          fill: 'white', fillOpacity: '.7'
        }),
        children || null
      );
    }
    const DOC_ICON_GENERIC = '#418CFF';   // text/doc: blue, 3 lines
    const DOC_ICON_PDF = '#EE5138';       // pdf: red
    const DOC_ICON_TABLE = '#3FB67F';     // xlsx/csv: green grid
    const DOC_ICON_IMAGE = '#8B76F6';     // image: purple
    const DOC_ICON_PPT = '#FB8E34';       // ppt: orange

    function FileTypeIcon({ ext }) {
      const e = String(ext || '').toLowerCase();
      if (e === 'pdf') return DocIconBase({ color: DOC_ICON_PDF, children: h('path', { d: 'M58.7034 18.7826C57.7262 18.7103 56.7852 18.3483 56.0251 17.6969C54.5412 18.0226 53.1297 18.4931 51.7182 19.0722C50.5962 21.0628 49.5466 22.0762 48.6418 22.0762C48.4608 22.0762 48.2437 22.04 48.0989 21.9314C47.7008 21.7505 47.4836 21.3523 47.4836 20.9542C47.4836 20.6285 47.556 19.7237 50.9943 18.2398C51.7906 16.7921 52.4058 15.3082 52.9125 13.7519C52.4782 12.8832 51.5372 10.7479 52.1887 9.66209C52.4058 9.26397 52.8402 9.04682 53.3107 9.08301C53.6726 9.08301 54.0345 9.26397 54.2517 9.55351C54.7222 10.205 54.686 11.5803 54.0707 13.6071C54.6498 14.6929 55.4098 15.6701 56.3147 16.5025C57.0747 16.3577 57.8348 16.2492 58.5948 16.2492C60.2959 16.2854 60.5492 17.0816 60.513 17.5521C60.513 18.7826 59.3187 18.7826 58.7034 18.7826ZM48.5694 21.0266L48.678 20.9904C49.1847 20.8094 49.5828 20.4475 49.8724 19.977C49.3295 20.1942 48.8952 20.5561 48.5694 21.0266ZM53.3831 10.1688H53.2745C53.2383 10.1688 53.1659 10.1688 53.1297 10.205C52.9849 10.8203 53.0935 11.4717 53.3469 12.0508C53.564 11.4355 53.564 10.7841 53.3831 10.1688ZM53.6364 15.4167L53.6002 15.4891L53.564 15.4529C53.2383 16.2854 52.8764 17.1178 52.4782 17.914L52.5506 17.8778V17.9502C53.3469 17.6607 54.2155 17.4073 55.0117 17.2264L54.9755 17.1902H55.0841C54.5412 16.6473 54.0345 16.032 53.6364 15.4167ZM58.5586 17.3349C58.2329 17.3349 57.9433 17.3349 57.6176 17.4073C57.9795 17.5883 58.3415 17.6607 58.7034 17.6969C58.9567 17.7331 59.2101 17.6969 59.4272 17.6245C59.4272 17.5159 59.2825 17.3349 58.5586 17.3349Z', fill: 'white', transform: 'translate(-40)' }) });
      if (['xlsx', 'xls', 'csv', 'tsv', 'tab'].includes(e)) return DocIconBase({ color: DOC_ICON_TABLE, children: h('g', { transform: 'translate(-80)', fill: 'white' },
        h('rect', { x: '89.3879', y: '11.6172', width: '4.24569', height: '4.24569', rx: '.458674' }),
        h('rect', { x: '89.3879', y: '16.5879', width: '4.24569', height: '4.24569', rx: '.458674' }),
        h('rect', { x: '94.3665', y: '11.6172', width: '4.24569', height: '4.24569', rx: '.458674' }),
        h('rect', { x: '94.3665', y: '16.5879', width: '4.24569', height: '4.24569', rx: '.458674' })
      ) });
      if (['ppt', 'pptx'].includes(e)) return DocIconBase({ color: DOC_ICON_PPT, children: h('g', { transform: 'translate(-160)', fill: 'white' },
        h('path', { d: 'M172.922 21.2661C175.337 21.2661 177.294 19.3088 177.294 16.8945C177.294 14.4802 175.337 12.5229 172.922 12.5229C170.508 12.5229 168.551 14.4802 168.551 16.8945C168.551 19.3088 170.508 21.2661 172.922 21.2661Z' })
      ) });
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'heif', 'svg', 'avif', 'tiff', 'ico'].includes(e)) return DocIconBase({ color: DOC_ICON_IMAGE, children: h('g', { transform: 'translate(-120)', fill: 'white' },
        h('path', { d: 'M130.421 15.9204C130.576 15.6558 130.958 15.6558 131.112 15.9204L133.649 20.2696C133.805 20.5362 133.612 20.8711 133.304 20.8711H128.23C127.921 20.8711 127.729 20.5362 127.884 20.2696L130.421 15.9204Z' }),
        h('path', { d: 'M135.498 13.186C135.65 12.9117 136.045 12.9117 136.197 13.186L140.137 20.2769C140.285 20.5435 140.092 20.8711 139.787 20.8711H131.908C131.603 20.8711 131.411 20.5435 131.559 20.2769L135.498 13.186Z' })
      ) });
      // generic text/doc: blue with 3 lines
      return DocIconBase({ color: DOC_ICON_GENERIC, children: h('g', { stroke: 'white', strokeWidth: '1.6' },
        h('path', { d: 'M8.10132 12.6846H19.8948' }),
        h('path', { d: 'M8.10132 16.4688H19.8948' }),
        h('path', { d: 'M8.10132 20.252H16.0199' })
      ) });
    }
    // #endregion

    const UPLOAD_URL = '/ds-attach/upload';
    const STATE_KEY = 'dsh-ds-attach:pending:v1';

    function safeStorage() { try { return window.localStorage; } catch (e) { return null; } }
    function readState() {
      try {
        const raw = safeStorage() && safeStorage().getItem(STATE_KEY);
        const o = raw ? JSON.parse(raw) : {};
        return o && typeof o === 'object' ? o : {};
      } catch (e) { return {}; }
    }
    function writeState(o) {
      try { safeStorage() && safeStorage().setItem(STATE_KEY, JSON.stringify(o)); } catch (e) {}
    }

    function fmtSize(n) {
      if (!n && n !== 0) return '';
      if (n < 1024) return n + ' B';
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1048576).toFixed(1) + ' MB';
    }
    function fileExt(name) {
      return (String(name).split('.').pop() || '').toLowerCase();
    }
    // #endregion

    // #region upload client
    async function uploadFile(sessionId, file) {
      const data = await readFileAsBase64(file);
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, name: file.name, data })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'upload failed');
      return json; // { path, size, name, ext, text, extracted, truncated }
    }
    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const str = typeof r.result === 'string' ? r.result : '';
          const idx = str.indexOf(',');
          resolve(idx >= 0 ? str.slice(idx + 1) : str);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
    }
    // #endregion

    // #region module-level pick bus
    const pickBus = (() => {
      const listeners = new Set();
      return {
        on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        emit(files) { for (const fn of [...listeners]) { try { fn(files); } catch (e) {} } }
      };
    })();
    // #endregion

    // #region upload button (official DS icon, input.left)
    function UploadButton(props) {
      const fileRef = useRef(null);
      const onFiles = useCallback((e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) pickBus.emit(files);
      }, []);
      return h('span', { style: { display: 'inline-flex' } },
        h('button', {
          type: 'button',
          title: '上传文档或图片（仅文本提取）',
          'aria-label': '上传文件',
          style: btnStyle,
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => { if (fileRef.current) fileRef.current.click(); }
        }, h(UploadIcon)),
        h('input', { ref: fileRef, type: 'file', multiple: true, style: { display: 'none' }, onChange: onFiles })
      );
    }
    const btnStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--dsw-alias-label-secondary)',
      padding: '7px',
      borderRadius: '8px',
      transition: 'background .12s ease, color .12s ease',
      minHeight: '34px'
    };
    // #endregion

    // #region DS-style file cards (240x64, radius 16, official classes)
    function FileCard(props) {
      const { item, onRemove } = props;
      const st = item.status; // 'uploading' | 'parsing' | 'done' | 'error' | 'empty'
      const statusText = st === 'uploading' ? '上传中…' : st === 'parsing' ? '解析中…（扫描件逐页识别，约需数分钟）' : st === 'error' ? '上传失败' : st === 'empty' ? '未提取到文本' : (item.truncated ? '（已截断）' : fmtSize(item.size));
      return h('div', { className: 'ds-attach-card', style: cardStyle },
        h('div', { style: cardInnerStyle },
          h('div', { style: iconBoxStyle },
            st === 'uploading' || st === 'parsing'
              ? h('span', { className: 'ds-attach-spinner' })
              : h(FileTypeIcon, { ext: item.ext || fileExt(item.name) })
          ),
          h('div', { style: textZoneStyle },
            h('p', { style: nameStyle }, item.name),
            h('p', { style: st === 'error' ? { ...statusStyle, color: 'var(--dsw-alias-state-error-primary)' } : statusStyle }, statusText)
          )
        ),
        h('button', {
          type: 'button',
          className: 'ds-attach-remove',
          style: removeBtnStyle,
          title: '移除',
          onClick: (e) => { e.stopPropagation(); onRemove(item.id); }
        }, h('span', { style: { fontSize: '11px', lineHeight: '11px' } }, '✕'))
      );
    }
    const cardStyle = {
      border: '1px solid var(--dsw-alias-border-l2)',
      backgroundColor: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-l2, #262626))',
      boxSizing: 'border-box',
      cursor: 'default',
      borderRadius: '16px',
      outline: 'none',
      flexShrink: '0',
      width: '240px',
      minHeight: '64px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    };
    const cardInnerStyle = {
      alignItems: 'center',
      height: '100%',
      paddingLeft: '12px',
      paddingRight: '12px',
      display: 'flex',
      position: 'relative'
    };
    const iconBoxStyle = {
      flexShrink: '0',
      justifyContent: 'center',
      alignItems: 'center',
      width: '28px',
      height: '28px',
      marginRight: '10px',
      display: 'flex'
    };
    const textZoneStyle = {
      WebkitUserSelect: 'none', userSelect: 'none',
      padding: '8px 0',
      overflow: 'hidden',
      minWidth: '0',
      flex: '1 1 auto'
    };
    const nameStyle = {
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minHeight: '20px',
      color: 'var(--dsw-alias-label-primary)',
      margin: '0',
      fontSize: '14px',
      fontWeight: '500',
      lineHeight: '22px',
      overflow: 'hidden'
    };
    const statusStyle = {
      margin: '0',
      fontSize: '12px',
      lineHeight: '15px',
      color: 'var(--dsw-alias-label-tertiary)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    };
    const removeBtnStyle = {
      // Visible by default so the card can always be removed; fully opaque on
      // hover (DS chat reveals on hover, but a fully hidden button made cards
      // impossible to remove when hover wasn't detected).
      opacity: '0.6',
      transition: 'opacity .15s ease',
      cursor: 'pointer',
      boxSizing: 'border-box',
      width: '18px',
      height: '18px',
      color: 'var(--dsw-alias-label-primary-inverted, #fff)',
      backgroundColor: 'var(--dsw-alias-button-contrast-fill, rgba(0,0,0,.75))',
      borderRadius: '50%',
      flexShrink: '0',
      position: 'absolute',
      top: '-6px',
      right: '-6px',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0'
    };
    // #endregion

    // #region attachment dock (cards above composer)
    function AttachDock(props) {
      const { sessionId, inputActions, conversation } = props;
      const [items, setItems] = useState([]);
      const itemsRef = useRef([]);
      itemsRef.current = items;

      useEffect(() => {
        try {
          const st = readState();
          setItems(Array.isArray(st[sessionId]) ? st[sessionId] : []);
        } catch (e) { setItems([]); }
      }, [sessionId]);

      const persist = (next) => {
        try {
          const st = readState();
          st[sessionId] = next;
          writeState(st);
        } catch (e) {}
      };

      const addFiles = useCallback(async (files) => {
        const list = Array.from(files || []);
        if (list.length === 0) return;
        // DeepSeek: images go through native vision, others via text extraction
        const images = list.filter((f) => f.type && f.type.startsWith('image/'));
        const others = list.filter((f) => !(f.type && f.type.startsWith('image/')));
        // Images: try native pipeline if available
        if (images.length > 0 && conversation && conversation.createDraftImages && inputActions && inputActions.addImages) {
          try {
            const drafts = conversation.createDraftImages(images);
            if (!inputActions.addImages(drafts.map((d) => d.id))) conversation.releaseDraftImages && conversation.releaseDraftImages(drafts);
          } catch (e) { /* ignore */ }
        }
        if (others.length === 0) return;
        const pending = others.map((f) => ({ name: f.name, size: 0, status: 'uploading', text: '', path: '', id: 'up-' + Date.now() + '-' + Math.random().toString(36).slice(2) }));
        const next = [...itemsRef.current, ...pending];
        setItems(next);
        persist(next);
        // Upload sequentially, updating status
        const results = [...next];
        for (let i = next.length - others.length; i < next.length; i++) {
          const item = results[i];
          const f = others[i - (next.length - others.length)];
          try {
            results[i] = { ...item, status: 'parsing' };
            setItems([...results]);
            const up = await uploadFile(sessionId, f);
            results[i] = {
              ...item,
              status: up.extracted ? 'done' : (up.text ? 'done' : 'empty'),
              text: up.text || '',
              size: up.size,
              path: up.path,
              truncated: !!up.truncated,
              ext: up.ext
            };
          } catch (e) {
            results[i] = { ...item, status: 'error' };
          }
          setItems([...results]);
          persist([...results]);
        }
      }, [sessionId, conversation, inputActions]);

      useEffect(() => pickBus.on(addFiles), [addFiles]);

      const removeItem = useCallback((id) => {
        const next = itemsRef.current.filter((it) => it.id !== id);
        setItems(next);
        persist(next);
      }, [sessionId]);

      // Inject extracted text into the draft on send (Enter), then clear the
      // pending cards. Format uses structured markers so the custom user-node
      // renderer can display real DS-style cards in the transcript:
      //   【附件】name.ext\n【文件大小】12345\n【文件内容】\n...\n【文件内容结束】
      const injectRef = useRef(() => {});
      useEffect(() => {
        injectRef.current = () => {
          const list = itemsRef.current.filter((it) => it.status === 'done' && it.text);
          if (list.length === 0) return;
          if (!inputActions || !inputActions.setDraft) return;
          const cur = (props.input && props.input.draft) || '';
          const blocks = list.map((it) => {
            // Host already caps text (DS_ATTACH_MAX_CHARS, default 150k) and
            // marks truncation; don't truncate again here or the full text
            // would never reach the model nor the card.
            return `【附件】${it.name}\n【文件大小】${it.size || 0}\n【文件内容】\n${it.text}\n【文件内容结束】`;
          });
          const addition = '\n\n' + blocks.join('\n\n');
          inputActions.setDraft(cur + addition);
          // Clear pending cards (they were sent as text).
          setItems([]);
          persist([]);
        };
      }, [inputActions, props.input]);

      useEffect(() => {
        function composerTextarea(target) {
          if (!target || target.tagName !== 'TEXTAREA') return null;
          return target.closest('[data-input-scroll]') ? target : null;
        }
        function menuOpen() {
          try {
            return !!document.querySelector('[role="listbox"], [role="menu"], [data-candidates], [aria-haspopup="listbox"][aria-expanded="true"]');
          } catch (e) { return false; }
        }
        function onEnter(e) {
          if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
          if (!composerTextarea(e.target)) return;
          if (menuOpen()) return;
          injectRef.current();
        }
        document.addEventListener('keydown', onEnter, true);
        return () => document.removeEventListener('keydown', onEnter, true);
      }, []);

      // Drag & drop: non-image files only (images -> native pipeline)
      useEffect(() => {
        if (!sessionId) return;
        let depth = 0;
        const hasFiles = (ev) => ev.dataTransfer && Array.prototype.includes.call(ev.dataTransfer.types || [], 'Files');
        const onDragEnter = (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); depth += 1; };
        const onDragOver = (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; };
        const onDragLeave = (ev) => { if (!hasFiles(ev)) return; depth = Math.max(0, depth - 1); };
        const onDrop = (ev) => {
          if (!hasFiles(ev)) return;
          ev.preventDefault();
          depth = 0;
          const files = Array.from(ev.dataTransfer.files || []);
          const nonImages = files.filter((f) => !(f.type && f.type.startsWith('image/')));
          if (nonImages.length > 0) addFiles(nonImages);
        };
        document.addEventListener('dragenter', onDragEnter);
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('dragleave', onDragLeave);
        document.addEventListener('drop', onDrop);
        return () => {
          document.removeEventListener('dragenter', onDragEnter);
          document.removeEventListener('dragover', onDragOver);
          document.removeEventListener('dragleave', onDragLeave);
          document.removeEventListener('drop', onDrop);
        };
      }, [sessionId, addFiles]);

      if (items.length === 0) return null;

      return h('div', { className: 'ds-attach-dock', style: dockStyle },
        h('div', { style: rowStyle },
          items.map((it) => h(FileCard, { key: it.id, item: it, onRemove: removeItem })),
          // Extra delete affordance for cards on hover is in CSS
        )
      );
    }

    const dockStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '0 2px',
      width: '100%',
      maxWidth: 'var(--dsh-composer-card-max-width, 720px)',
      margin: '0 auto',
      boxSizing: 'border-box'
    };
    const rowStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      alignItems: 'flex-start'
    };
    // #endregion

    // #region user message renderer (shows DS-style attachment cards)
    // Registered at priority -1 to shadow the product's user renderer
    // ("lowest renders"). Parses our structured markers:
    //   【附件】name\n【文件大小】N\n【文件内容】\n...\n【文件内容结束】
    // and renders the attachment as a real card; plain text renders normally.
    // Any render error falls back to a plain <pre> so no message goes blank.
    const SPEC_PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives';
    function realGlobal() {
      try { if (typeof window !== 'undefined' && window) return window; } catch (e) {}
      try { if (typeof globalThis !== 'undefined' && globalThis) return globalThis; } catch (e) {}
      return null;
    }
    function pickNamed(mod, key) {
      if (!mod) return null;
      if (typeof mod[key] === 'function') return mod;
      if (mod.default && typeof mod.default[key] === 'function') return mod.default;
      return null;
    }
    function fromSystem(ms, spec, key) {
      if (!ms) return null;
      const tries = [];
      try { if (ms.seed && typeof ms.seed.get === 'function') tries.push(ms.seed.get(spec)); } catch (e) {}
      try { if (ms.statics && typeof ms.statics.get === 'function') tries.push(ms.statics.get(spec)); } catch (e) {}
      for (let i = 0; i < tries.length; i++) {
        const hit = pickNamed(tries[i], key);
        if (hit) return hit;
      }
      return null;
    }
    function resolveModule(spec, key) {
      const g = realGlobal();
      return fromSystem(g && g.__DSH_MODULES__, spec, key);
    }

    function extractAttachments(text) {
      const out = [];
      const plainParts = [];
      // CRLF-safe: message text may carry \r\n (Windows textarea normalization),
      // which would break a plain-\n regex between the markers.
      const re = /【附件】([^\r\n]+)[\r\n]+【文件大小】(\d+)[\r\n]+【文件内容】[\r\n]+([\s\S]*?)【文件内容结束】/g;
      let m;
      let last = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) plainParts.push(text.slice(last, m.index));
        out.push({ name: m[1], size: Number(m[2]) || 0, content: m[3] });
        last = m.index + m[0].length;
      }
      if (last < text.length) plainParts.push(text.slice(last));
      // Fallback: strict regex found nothing but the markers exist (odd
      // spacing / extra whitespace between them) — locate them loosely.
      if (out.length === 0 && text.includes('【附件】') && text.includes('【文件内容结束】')) {
        try {
          const nameM = text.match(/【附件】\s*([^\r\n【】]+)/);
          const sizeM = text.match(/【文件大小】\s*(\d+)/);
          const bodyStart = text.indexOf('【文件内容】');
          const bodyEnd = text.indexOf('【文件内容结束】');
          if (nameM && sizeM && bodyStart >= 0 && bodyEnd > bodyStart) {
            const body = text.slice(bodyStart + '【文件内容】'.length, bodyEnd)
              .replace(/^\s*[\r\n]+/, '').replace(/[\r\n]+\s*$/, '');
            out.push({ name: nameM[1].trim(), size: Number(sizeM[1]) || 0, content: body });
            plainParts.length = 0;
            plainParts.push(text.slice(0, bodyStart), text.slice(bodyEnd + '【文件内容结束】'.length));
          }
        } catch (e) { /* keep whatever we have */ }
      }
      return { attachments: out, plain: plainParts.join('').trim() };
    }

    function UserMessageWithAttachments(props) {
      const { node, loadImage } = props;
      const [expanded, setExpanded] = useState({});
      let data = {};
      let content = [];
      try {
        data = (node && node.data) || {};
        content = Array.isArray(data.content) ? data.content : [];
      } catch (e) { content = []; }
      // Merge text blocks (same as product contentParts).
      let text = '';
      const images = [];
      for (const b of content) {
        if (b && b.type === 'text' && typeof b.text === 'string') text += b.text;
        else if (b && b.type === 'image' && b.attachment !== void 0) images.push({ attachment: b.attachment });
      }
      let attachments = [];
      let plain = text;
      try {
        const parsed = extractAttachments(text);
        attachments = parsed.attachments;
        plain = parsed.plain;
      } catch (e) {
        attachments = [];
        plain = text;
      }
      const toggle = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

      // Try native MarkdownText for plain text; fall back to <pre>.
      const primsRef = useRef(null);
      if (primsRef.current === null) {
        try { primsRef.current = resolveModule(SPEC_PRIMITIVES, 'MarkdownText'); } catch (e) { primsRef.current = null; }
      }
      const MarkdownText = primsRef.current && typeof primsRef.current.MarkdownText === 'function'
        ? primsRef.current.MarkdownText : null;

      // Reuse DSH's ImageGallery for image blocks (full-size thumbnails,
      // lightbox, loading states) instead of a placeholder emoji.
      const galleryRef = useRef(null);
      if (galleryRef.current === null) {
        try { galleryRef.current = resolveModule('@deepseek-ai/dsh-client-ui-attachment', 'ImageGallery'); } catch (e) { galleryRef.current = null; }
      }
      const ImageGallery = galleryRef.current || null;
      const imageEl = images.length > 0 ? (ImageGallery
        ? h(ImageGallery, {
            images,
            load: loadImage || (() => Promise.reject(new Error('no image loader'))),
            align: 'end',
            labels: {}
          })
        : h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' } },
            images.map((img, i) => {
              const url = img.attachment && (img.attachment.url || img.attachment.previewUrl);
              return url
                ? h('img', { key: i, src: url, style: { maxWidth: '240px', maxHeight: '240px', borderRadius: '12px', display: 'block' } })
                : h('div', { key: i, style: { width: '96px', height: '96px', borderRadius: '8px', background: 'var(--dsw-alias-interactive-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px' } }, '图片');
            })
          )
        : null;

      const plainEl = plain
        ? h('div', { style: bubbleStyle }, MarkdownText
            ? h(MarkdownText, { text: plain, streaming: false })
            : h('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, plain))
        : null;

      // Wrap everything in the same visual stack the product uses
      // (userStack: align-end, max-width 82%) so plain messages render
      // exactly like the original light-blue bubble.
      return h('div', { style: userRowStyle, 'data-time-hover-root': true },
        h('div', { style: userStackStyle },
          imageEl,
          attachments.length > 0 ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', width: '100%' } },
            attachments.map((a, i) => h('div', {
              key: i,
              style: { width: '240px', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-l2, #262626))', borderRadius: '16px', padding: '10px 12px', cursor: 'pointer', boxSizing: 'border-box' },
              onClick: () => toggle(i)
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                h(FileTypeIcon, { ext: (a.name.split('.').pop() || '').toLowerCase() }),
                h('div', { style: { minWidth: '0', flex: '1 1 auto' } },
                  h('div', { style: { fontSize: '14px', fontWeight: '500', color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, a.name),
                  h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' } }, fmtSize(a.size) + (expanded[i] ? ' · 收起' : ' · 查看内容'))
                )
              ),
              expanded[i] ? h('div', { style: { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,.1))', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', maxHeight: '260px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, a.content) : null
            ))
          ) : null,
          plainEl
        )
      );
    }
    const userRowStyle = {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '6px',
      display: 'flex',
      width: '100%'
    };
    const userStackStyle = {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px',
      minWidth: '0',
      maxWidth: 'min(525px, 82%)',
      display: 'flex'
    };
    const bubbleStyle = {
      // Exact product user-bubble style (浅蓝气泡): same vars as the
      // product's .gdEzaW_bubble so plain messages look identical.
      background: 'var(--dsw-specific-bubble)',
      maxWidth: '100%',
      color: 'var(--dsw-alias-label-primary)',
      borderRadius: '22px',
      padding: '10px 16px',
      fontSize: '16px',
      lineHeight: '24px',
      overflowWrap: 'anywhere'
    };
    // #endregion

    // #region plugin entry
    const CSS = [
      '.ds-attach button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      // Delete button appears on card hover (matches DS chat)
      '.ds-attach-card:hover .ds-attach-remove, .ds-attach-card:focus-within .ds-attach-remove{opacity:1}',
      // Circular spinner (DS chat shows a ring while uploading/parsing)
      '.ds-attach-spinner{width:16px;height:16px;border:2px solid var(--dsw-alias-label-tertiary);border-top-color:transparent;border-radius:50%;display:inline-block;animation:ds-attach-spin .8s linear infinite}',
      '@keyframes ds-attach-spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.ds-attach button,.ds-attach-spinner{transition:none;animation:none}}'
    ].join('\n');

    function injectStyles() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('style[data-plugin="dsh-ds-attach"]')) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-ds-attach';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    const inject = ['slots', 'sessions'];

    function apply(ctx) {
      injectStyles();
      const slots = ctx.get('slots');
      const sessions = ctx.get('sessions');
      if (!slots) return;

      // Upload button (official DS icon) in composer leading zone.
      slots.inject('conversation.input.left', () => slots.register({
        name: 'conversation.input.left',
        id: 'ds-attach-upload',
        order: 1,
        inject: (sessionId) => ({ sessionId })
      }, UploadButton));

      // File cards docked above composer.
      slots.inject('conversation.input.dock', () => slots.register({
        name: 'conversation.input.dock',
        id: 'ds-attach-dock',
        order: 30,
        inject: (sessionId) => {
          let inputActions;
          let conversation;
          try {
            const actx = sessions && sessions.scope(sessionId);
            if (actx) {
              const conv = actx.get('conversation');
              if (conv) {
                conversation = conv;
                if (conv.input && conv.input.for) inputActions = conv.input.for(actx).actions;
              }
            }
          } catch (e) { /* optional */ }
          return { sessionId, inputActions, conversation };
        }
      }, AttachDock));

      // Custom user-node renderer: shadows the product's user renderer at a
      // lower priority ("lowest renders") to display attachment cards in the
      // transcript; messages without attachments render plain text.
      slots.inject('conversation.chat.node', () => slots.register({
        name: 'conversation.chat.node',
        key: 'user',
        priority: -1
      }, UserMessageWithAttachments));
    }

    return { inject, apply };
    // #endregion
  }
});
