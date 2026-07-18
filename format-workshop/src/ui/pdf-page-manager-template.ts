export const pdfPageManagerTemplate = `
  <div class="page-manager-upload" data-manager-upload>
    <input class="visually-hidden" data-manager-input type="file" accept="application/pdf" tabindex="-1" aria-hidden="true" />
    <span class="upload-icon" aria-hidden="true"><i data-lucide="GalleryThumbnails"></i></span>
    <div><h3>选择需要整理的 PDF</h3><p>最多 100 页 / 60 MB · 全程在当前浏览器处理</p></div>
    <button class="button button-upload" type="button" data-manager-select>选择 PDF</button>
  </div>

  <div class="page-manager-progress" data-manager-loading hidden aria-live="polite">
    <div class="progress-head"><span data-manager-loading-message>正在读取页面</span><div class="progress-actions"><strong data-manager-loading-value>0%</strong><button class="button button-secondary cancel-button" type="button" data-manager-cancel><i data-lucide="Square"></i><span>取消</span></button></div></div>
    <progress class="progress-track" data-manager-loading-bar max="100" value="0">0%</progress>
  </div>

  <div class="error-panel" data-manager-error hidden role="alert"><span aria-hidden="true">!</span><p></p></div>

  <div class="page-manager-editor" data-manager-editor hidden>
    <div class="page-manager-filebar">
      <div><strong data-manager-file-name></strong><small data-manager-file-meta></small></div>
      <button class="button button-secondary" type="button" data-manager-reset><i data-lucide="RefreshCw"></i><span>更换文件</span></button>
    </div>

    <div class="page-manager-toolbar">
      <div><h3>页面顺序</h3><p>拖动缩略图调整位置，也可使用每页下方的移动按钮。</p></div>
      <span data-manager-page-count></span>
    </div>
    <p class="visually-hidden" data-manager-announcement aria-live="polite"></p>
    <div class="page-manager-grid" data-manager-grid role="list" aria-label="PDF 页面顺序"></div>

    <div class="page-manager-settings">
      <div class="page-manager-setting-block">
        <span class="control-label">输出方式</span>
        <div class="manager-compression-options" data-manager-compression role="group" aria-label="PDF 压缩方式">
          <button type="button" data-value="preserve"><strong>保留文本</strong><small>整理结构，不扁平化</small></button>
          <button type="button" data-value="standard"><strong>标准压缩</strong><small>清晰度与体积平衡</small></button>
          <button type="button" data-value="compact"><strong>强力压缩</strong><small>更小体积</small></button>
        </div>
        <p class="manager-compression-note" data-manager-compression-note></p>
      </div>

      <div class="page-manager-decoration-grid">
        <label class="manager-check"><input type="checkbox" data-manager-page-numbers /><span>添加页码</span></label>
        <label class="manager-watermark"><span>文字水印</span><input type="text" data-manager-watermark maxlength="40" placeholder="可选，最多 40 个字符" /></label>
        <label class="manager-opacity"><span>水印透明度 <output data-manager-opacity-value>18%</output></span><input type="range" data-manager-opacity min="8" max="42" step="2" value="18" /></label>
      </div>

      <button class="button button-primary manager-export" type="button" data-manager-export><span>生成 PDF</span><i data-lucide="ArrowRight"></i></button>
    </div>
  </div>

  <div class="result-panel manager-result" data-manager-result hidden aria-live="polite">
    <div class="result-heading"><span class="success-icon" aria-hidden="true"><i data-lucide="CircleCheck"></i></span><div><h2>PDF 已生成</h2><p data-manager-result-name></p><small data-manager-result-metrics></small></div></div>
    <div class="pdf-result-preview"><img data-manager-result-preview alt="页面管理后的 PDF 预览" /></div>
    <p class="manager-result-note" data-manager-result-note></p>
    <div class="result-actions"><a class="button button-primary" data-manager-download><i data-lucide="Download"></i><span>下载 PDF</span></a><button class="button button-secondary" type="button" data-manager-edit-again><i data-lucide="RotateCcw"></i><span>继续调整</span></button><button class="button button-secondary" type="button" data-manager-new><i data-lucide="RefreshCw"></i><span>处理其他文件</span></button></div>
  </div>
`;
