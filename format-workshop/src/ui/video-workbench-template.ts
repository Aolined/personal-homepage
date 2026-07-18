export const videoWorkbenchTemplate = `
  <div class="video-toolbox-heading">
    <div><h2>视频工具箱</h2></div>
    <p>六种常用视频处理能力，全部在当前浏览器本地完成。</p>
  </div>
  <div class="video-tool-tabs" role="tablist" aria-label="视频工具">
    <button type="button" role="tab" data-video-tool="compress"><span><i data-lucide="Gauge"></i></span><strong>MP4 压缩</strong><small>画质与体积平衡</small></button>
    <button type="button" role="tab" data-video-tool="trim"><span><i data-lucide="Scissors"></i></span><strong>时间裁剪</strong><small>保留指定片段</small></button>
    <button type="button" role="tab" data-video-tool="gif"><span><i data-lucide="Image"></i></span><strong>视频转 GIF</strong><small>最长 30 秒</small></button>
    <button type="button" role="tab" data-video-tool="snapshot"><span><i data-lucide="Camera"></i></span><strong>视频截图</strong><small>导出 JPG 或 PNG</small></button>
    <button type="button" role="tab" data-video-tool="transform"><span><i data-lucide="Crop"></i></span><strong>旋转与裁切</strong><small>居中调整画面</small></button>
    <button type="button" role="tab" data-video-tool="audio"><span><i data-lucide="Music2"></i></span><strong>导出音频</strong><small>MP3 / M4A / WAV</small></button>
  </div>

  <div class="video-drop-zone" data-video-drop-zone>
    <input class="visually-hidden" type="file" accept="video/mp4" data-video-input tabindex="-1" aria-hidden="true" />
    <div class="video-empty" data-video-empty>
      <span class="video-upload-icon" aria-hidden="true"><i data-lucide="Upload"></i></span>
      <div><h3>选择 MP4 视频</h3><p>单个文件不超过 150 MB，时长不超过 10 分钟</p></div>
      <button class="button button-upload" type="button" data-video-select>选择文件</button>
    </div>
    <div class="video-source" data-video-source hidden>
      <video controls preload="metadata" data-video-preview aria-label="源视频预览"></video>
      <div class="video-source-copy"><strong data-video-name></strong><small data-video-meta></small><p>可在预览中定位画面，再设置时间或输出参数。</p></div>
      <button class="icon-button" type="button" data-video-clear aria-label="移除视频" title="移除视频"><i data-lucide="X"></i></button>
    </div>
  </div>

  <div class="video-settings" data-video-settings hidden>
    <div class="video-preset-bar">
      <label><span>参数预设</span><select data-video-preset-select aria-label="选择视频参数预设"><option value="">选择预设</option></select></label>
      <button class="button button-secondary" type="button" data-video-preset-apply>应用</button>
      <label class="video-preset-name"><span>预设名称</span><input type="text" maxlength="20" autocomplete="off" placeholder="例如：短视频高清" data-video-preset-name /></label>
      <button class="button button-secondary" type="button" data-video-preset-save aria-label="保存参数预设" title="保存参数预设"><i data-lucide="Save"></i><span>保存</span></button>
      <button class="icon-button" type="button" data-video-preset-delete aria-label="删除所选预设" title="删除所选预设"><i data-lucide="Trash2"></i></button>
      <small data-video-preset-status aria-live="polite"></small>
    </div>

    <div class="video-settings-row">
      <div class="video-settings-grid" data-compress-settings>
        <fieldset><legend>压缩质量</legend><div class="video-segmented" data-compress-quality><button type="button" data-value="small">更小体积</button><button type="button" data-value="balanced">均衡</button><button type="button" data-value="high">高清</button></div></fieldset>
        <fieldset><legend>最大分辨率</legend><div class="video-segmented" data-compress-resolution><button type="button" data-value="source">原始</button><button type="button" data-value="1080">1080p</button><button type="button" data-value="720">720p</button><button type="button" data-value="480">480p</button></div></fieldset>
        <fieldset><legend>帧率</legend><div class="video-segmented" data-compress-fps><button type="button" data-value="source">原始</button><button type="button" data-value="30">30 fps</button><button type="button" data-value="24">24 fps</button></div></fieldset>
        <label class="video-toggle"><input type="checkbox" data-compress-audio /><span>移除音频</span><small>进一步减小文件</small></label>
      </div>

      <div class="video-settings-grid video-range-settings" data-trim-settings hidden>
        <div class="video-time-range"><label>开始时间<input type="number" min="0" step="0.1" inputmode="decimal" data-trim-start /><small>秒</small></label><label>结束时间<input type="number" min="0.1" step="0.1" inputmode="decimal" data-trim-end /><small>秒</small></label></div>
        <p data-trim-summary></p><label class="video-toggle"><input type="checkbox" data-trim-audio /><span>移除音频</span><small>输出静音片段</small></label>
      </div>

      <div class="video-settings-grid video-range-settings" data-gif-settings hidden>
        <div class="video-time-range"><label>开始时间<input type="number" min="0" step="0.1" inputmode="decimal" data-gif-start /><small>秒</small></label><label>结束时间<input type="number" min="0.1" step="0.1" inputmode="decimal" data-gif-end /><small>秒</small></label></div>
        <p data-gif-summary></p>
        <fieldset><legend>GIF 宽度</legend><div class="video-segmented" data-gif-width><button type="button" data-value="480">480 px</button><button type="button" data-value="640">640 px</button><button type="button" data-value="800">800 px</button></div></fieldset>
        <fieldset><legend>GIF 帧率</legend><div class="video-segmented" data-gif-fps><button type="button" data-value="8">8 fps</button><button type="button" data-value="12">12 fps</button><button type="button" data-value="15">15 fps</button></div></fieldset>
      </div>

      <div class="video-settings-grid video-snapshot-settings" data-snapshot-settings hidden>
        <label class="video-number-field"><span>截图时间</span><input type="number" min="0" step="0.1" inputmode="decimal" data-snapshot-time /><small>秒</small></label>
        <button class="button button-secondary" type="button" data-snapshot-current><i data-lucide="Crosshair"></i><span>使用当前画面</span></button>
        <fieldset><legend>图片格式</legend><div class="video-segmented" data-snapshot-format><button type="button" data-value="jpeg">JPG</button><button type="button" data-value="png">PNG</button></div></fieldset>
        <p data-snapshot-summary></p>
      </div>

      <div class="video-settings-grid" data-transform-settings hidden>
        <fieldset><legend>旋转</legend><div class="video-segmented" data-transform-rotation><button type="button" data-value="0">不旋转</button><button type="button" data-value="90">顺时针 90°</button><button type="button" data-value="180">180°</button><button type="button" data-value="270">逆时针 90°</button></div></fieldset>
        <fieldset><legend>居中裁切比例</legend><div class="video-segmented" data-transform-crop><button type="button" data-value="source">原始</button><button type="button" data-value="square">1:1</button><button type="button" data-value="16:9">16:9</button><button type="button" data-value="9:16">9:16</button><button type="button" data-value="4:3">4:3</button></div></fieldset>
        <label class="video-toggle"><input type="checkbox" data-transform-audio /><span>移除音频</span><small>可单独生成静音视频</small></label>
        <p data-transform-summary></p>
      </div>

      <div class="video-settings-grid video-audio-settings" data-extract-audio-settings hidden>
        <fieldset><legend>音频格式</legend><div class="video-segmented" data-extract-audio-format><button type="button" data-value="mp3">MP3</button><button type="button" data-value="m4a">M4A</button><button type="button" data-value="wav">WAV</button></div></fieldset>
        <fieldset data-extract-bitrate-setting><legend>音频码率</legend><div class="video-segmented" data-extract-audio-bitrate><button type="button" data-value="128">128 kbps</button><button type="button" data-value="192">192 kbps</button><button type="button" data-value="256">256 kbps</button></div></fieldset>
        <p>提取第一条可用音轨，不保留源文件元数据。</p>
      </div>

      <button class="button button-primary video-run" type="button" data-video-run><span data-video-run-label></span><i data-lucide="Film"></i></button>
    </div>
  </div>

  <div class="progress-panel" data-video-progress hidden aria-live="polite">
    <div class="progress-head"><span data-video-progress-message></span><div class="progress-actions"><strong data-video-progress-value>0%</strong><button class="button button-secondary cancel-button" type="button" data-video-cancel><i data-lucide="Square"></i><span>取消</span></button></div></div>
    <progress class="progress-track" data-video-progress-bar max="100" value="0">0%</progress>
  </div>
  <div class="error-panel" data-video-error hidden role="alert"><span aria-hidden="true">!</span><p></p></div>
  <div class="result-panel video-result" data-video-result hidden aria-live="polite">
    <div class="result-heading"><span class="success-icon" aria-hidden="true"><i data-lucide="CheckCircle2"></i></span><div><h2>处理完成</h2><p data-video-result-name></p><small data-video-result-meta></small></div></div>
    <div class="video-compare-grid">
      <figure><figcaption>源文件</figcaption><video controls preload="metadata" data-video-compare-source aria-label="源视频对比预览"></video></figure>
      <figure><figcaption>处理结果</figcaption><div class="video-result-media"><video controls preload="metadata" data-video-result-video aria-label="处理后视频预览"></video><img data-video-result-image alt="处理后图片预览" /><audio controls preload="metadata" data-video-result-audio aria-label="导出的音频预览"></audio></div></figure>
    </div>
    <div class="result-actions"><a class="button button-primary" data-video-download><i data-lucide="Download"></i><span>下载结果</span></a><button class="button button-secondary" type="button" data-video-continue><i data-lucide="SlidersHorizontal"></i><span>继续调整</span></button><button class="button button-secondary" type="button" data-video-reset><i data-lucide="X"></i><span>处理其他视频</span></button></div>
  </div>
`;
