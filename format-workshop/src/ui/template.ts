export const workbenchTemplate = `
  <header class="site-header">
    <a class="brand" href="#converter" aria-label="格式工坊首页">
      <span class="brand-mark" aria-hidden="true"><i data-lucide="RefreshCw"></i></span>
      <span>格式工坊</span>
    </a>
    <div class="header-meta">
      <button class="button install-button" type="button" data-install-app hidden>
        <i data-lucide="Download"></i><span>安装应用</span>
      </button>
      <div class="privacy-badge"><i data-lucide="LockKeyhole"></i><span>文件不离开设备</span></div>
    </div>
  </header>

  <main>
    <section class="intro" aria-labelledby="page-title">
      <div>
        <h1 id="page-title">文件转换与处理</h1>
        <p>图片、音频、视频和 PDF，全部在当前浏览器内完成。</p>
      </div>
    </section>

    <section class="workbench-band" id="converter" aria-label="文件转换器">
      <div class="workbench">
        <div class="mode-tabs" role="tablist" aria-label="转换类型">
          <button class="mode-tab" type="button" role="tab" data-mode="image">
            <span class="mode-glyph"><i data-lucide="Image"></i></span>
            <span class="mode-copy"><strong>图片转换</strong><small>JPG / PNG / WEBP</small></span>
          </button>
          <button class="mode-tab" type="button" role="tab" data-mode="media">
            <span class="mode-glyph"><i data-lucide="Video"></i></span>
            <span class="mode-copy"><strong>音频格式转换</strong><small>MP4 / MP3 / WAV / M4A / AAC / FLAC / OGG</small></span>
          </button>
          <button class="mode-tab" type="button" role="tab" data-mode="video">
            <span class="mode-glyph"><i data-lucide="Clapperboard"></i></span>
            <span class="mode-copy"><strong>视频工具箱</strong><small>压缩 / 裁剪 / 截图 / GIF</small></span>
          </button>
          <button class="mode-tab" type="button" role="tab" data-mode="pdf">
            <span class="mode-glyph"><i data-lucide="FileText"></i></span>
            <span class="mode-copy"><strong>PDF 工具箱</strong><small>转换 / 合并 / 拆分</small></span>
          </button>
        </div>

        <div class="tool-body" data-standard-tool-body>
          <div class="drop-zone" data-drop-zone>
            <input class="visually-hidden" type="file" data-file-input tabindex="-1" aria-hidden="true" />
            <input class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" data-folder-input webkitdirectory directory multiple tabindex="-1" aria-hidden="true" />
            <div class="empty-upload" data-empty-upload>
              <span class="upload-icon" aria-hidden="true"><i data-lucide="CloudUpload"></i></span>
              <div>
                <h2 data-upload-title>选择图片</h2>
                <p data-upload-meta>JPG、PNG、WebP · 最大 25 MB</p>
              </div>
              <div class="upload-actions">
                <button class="button button-upload" type="button" data-select-file>选择文件</button>
                <button class="button button-secondary" type="button" data-select-folder>
                  <i data-lucide="FolderOpen"></i><span>选择文件夹</span>
                </button>
              </div>
            </div>

            <p class="folder-status" data-folder-status aria-live="polite"></p>
            <div class="file-stage" data-file-stage hidden>
              <div class="source-preview">
                <img data-source-image alt="所选图片预览" hidden />
                <video data-source-video aria-label="所选视频预览" controls preload="metadata" hidden></video>
                <audio data-source-audio aria-label="所选音频预览" controls preload="metadata" hidden></audio>
                <span class="source-placeholder" data-source-placeholder aria-hidden="true">
                  <i data-lucide="FileImage"></i>
                </span>
              </div>
              <div class="file-summary">
                <p class="file-name" data-file-name></p>
                <p class="file-meta" data-file-meta></p>
                <dl class="file-info-grid" data-file-info></dl>
                <div class="file-queue" data-file-queue></div>
                <div class="file-actions">
                  <button class="button button-secondary add-files-button" type="button" data-add-files>
                    <i data-lucide="Plus"></i><span>添加图片</span>
                  </button>
                  <button class="button button-secondary add-folder-button" type="button" data-add-folder>
                    <i data-lucide="FolderOpen"></i><span>添加文件夹</span>
                  </button>
                </div>
              </div>
              <button class="icon-button" type="button" data-remove-file aria-label="移除文件" title="移除文件">
                <i data-lucide="X"></i>
              </button>
            </div>
          </div>

          <div class="conversion-controls" data-conversion-controls hidden>
            <div class="standard-preset-bar" data-standard-preset-bar>
              <label><span>参数预设</span><select data-standard-preset-select aria-label="选择参数预设"></select></label>
              <button class="button button-secondary" type="button" data-standard-preset-apply>应用</button>
              <label class="standard-preset-name"><span>预设名称</span><input type="text" maxlength="20" autocomplete="off" placeholder="例如：日常导出" data-standard-preset-name /></label>
              <button class="button button-secondary" type="button" data-standard-preset-save aria-label="保存参数预设" title="保存参数预设"><i data-lucide="Save"></i><span>保存</span></button>
              <button class="icon-button" type="button" data-standard-preset-delete aria-label="删除所选预设" title="删除所选预设"><i data-lucide="Trash2"></i></button>
              <button class="button button-secondary" type="button" data-use-last-settings>使用上次设置</button>
              <small data-standard-preset-status aria-live="polite"></small>
            </div>
            <div class="control-group">
              <span class="control-label">转换为</span>
              <div class="format-options" data-target-options aria-label="输出格式"></div>
            </div>
            <div class="settings-panel" data-image-settings>
              <div class="setting-group quality-setting">
                <div class="setting-heading">
                  <label for="image-quality">图片质量</label>
                  <output for="image-quality" data-quality-value>90%</output>
                </div>
                <input id="image-quality" class="quality-slider" data-quality-input type="range" min="40" max="100" step="1" value="90" />
              </div>
              <div class="setting-group dimension-setting">
                <div class="setting-heading">
                  <span>最大尺寸</span>
                  <small>留空保持原尺寸，始终等比缩放</small>
                </div>
                <div class="dimension-inputs">
                  <label><span>宽</span><input data-max-width type="number" min="1" max="12000" inputmode="numeric" placeholder="原始" /><small>px</small></label>
                  <span aria-hidden="true">×</span>
                  <label><span>高</span><input data-max-height type="number" min="1" max="12000" inputmode="numeric" placeholder="原始" /><small>px</small></label>
                </div>
              </div>
              <div class="setting-group image-transform-setting">
                <div class="setting-heading">
                  <span>方向与翻转</span>
                  <small>按输出画面调整</small>
                </div>
                <div class="compact-options" data-rotation-options aria-label="图片旋转角度"></div>
                <div class="toggle-row">
                  <label><input type="checkbox" data-flip-horizontal />水平翻转</label>
                  <label><input type="checkbox" data-flip-vertical />垂直翻转</label>
                </div>
              </div>
              <div class="setting-group watermark-setting">
                <div class="setting-heading">
                  <label for="watermark-text">文字水印</label>
                  <small>最多 40 字，可留空</small>
                </div>
                <input id="watermark-text" class="text-setting-input" data-watermark-text maxlength="40" placeholder="输入水印内容" />
                <div class="split-setting-row">
                  <select data-watermark-position aria-label="水印位置">
                    <option value="bottom-right">右下</option>
                    <option value="bottom-left">左下</option>
                    <option value="top-right">右上</option>
                    <option value="top-left">左上</option>
                    <option value="center">居中</option>
                  </select>
                  <label class="inline-range"><span>不透明度</span><input data-watermark-opacity type="range" min="10" max="100" step="5" value="70" /></label>
                </div>
              </div>
              <div class="setting-group rename-setting">
                <div class="setting-heading">
                  <label for="rename-base">批量重命名</label>
                  <small>自动追加 01、02…</small>
                </div>
                <input id="rename-base" class="text-setting-input" data-rename-base maxlength="80" placeholder="留空保留原文件名" />
              </div>
            </div>
            <div class="settings-panel audio-settings" data-audio-settings hidden>
              <div class="setting-group" data-bitrate-setting>
                <div class="setting-heading">
                  <span>音频码率</span>
                  <small>码率越高，文件越大</small>
                </div>
                <div class="bitrate-options" data-bitrate-options aria-label="音频码率"></div>
              </div>
              <div class="setting-group">
                <div class="setting-heading">
                  <span>采样率</span>
                  <small>原始可避免不必要的重采样</small>
                </div>
                <div class="audio-option-grid" data-sample-rate-options aria-label="音频采样率"></div>
              </div>
              <div class="setting-group">
                <div class="setting-heading">
                  <span>声道</span>
                  <small>单声道体积通常更小</small>
                </div>
                <div class="audio-option-grid" data-channel-options aria-label="音频声道"></div>
              </div>
              <div class="setting-group">
                <div class="setting-heading">
                  <span>裁剪片段</span>
                  <small>秒</small>
                </div>
                <div class="time-input-row">
                  <label><span>开始</span><input data-audio-trim-start type="number" min="0" max="43200" step="0.1" value="0" /></label>
                  <label><span>结束</span><input data-audio-trim-end type="number" min="0.1" max="43200" step="0.1" placeholder="原结尾" /></label>
                </div>
              </div>
              <div class="setting-group">
                <div class="setting-heading">
                  <label for="audio-volume">音量</label>
                  <output for="audio-volume" data-audio-volume-value>100%</output>
                </div>
                <input id="audio-volume" class="quality-slider" data-audio-volume type="range" min="0" max="200" step="5" value="100" />
                <label class="toggle-control"><input type="checkbox" data-audio-normalize />标准化响度</label>
              </div>
              <div class="setting-group">
                <div class="setting-heading">
                  <span>速度与淡化</span>
                  <small>淡入淡出最长 10 秒</small>
                </div>
                <div class="split-setting-row audio-timing-row">
                  <select data-audio-speed aria-label="播放速度">
                    <option value="0.5">0.5×</option>
                    <option value="0.75">0.75×</option>
                    <option value="1" selected>1×</option>
                    <option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                  </select>
                  <label><span>淡入</span><input data-audio-fade-in type="number" min="0" max="10" step="0.5" value="0" /></label>
                  <label><span>淡出</span><input data-audio-fade-out type="number" min="0" max="10" step="0.5" value="0" /></label>
                </div>
              </div>
            </div>
            <button class="button button-primary convert-button" type="button" data-convert>
              <span data-convert-label>开始转换</span><i data-lucide="ArrowRight"></i>
            </button>
          </div>

          <div class="progress-panel" data-progress-panel hidden aria-live="polite">
            <div class="progress-head">
              <span data-progress-message>正在准备</span>
              <div class="progress-actions">
                <strong data-progress-value>0%</strong>
                <button class="button button-secondary cancel-button" type="button" data-cancel>
                  <i data-lucide="Square"></i><span>取消</span>
                </button>
              </div>
            </div>
            <progress class="progress-track" data-progress-bar aria-label="转换进度" max="100" value="0">0%</progress>
          </div>

          <div class="error-panel" data-error-panel hidden role="alert">
            <span aria-hidden="true">!</span>
            <p data-error-message></p>
          </div>

          <div class="result-panel" data-result-panel hidden aria-live="polite">
            <div class="result-heading">
              <span class="success-icon" aria-hidden="true"><i data-lucide="CircleCheck"></i></span>
              <div><h2>转换完成</h2><p data-result-name></p><small data-result-metrics></small></div>
            </div>
            <div class="result-preview">
              <img data-result-image alt="转换结果预览" hidden />
              <audio data-result-audio aria-label="转换后的音频" controls hidden></audio>
            </div>
            <div class="result-list" data-result-list></div>
            <div class="result-actions">
              <a class="button button-primary" data-download><i data-lucide="Download"></i><span>下载文件</span></a>
              <button class="button button-primary" type="button" data-download-zip hidden>
                <i data-lucide="Package"></i><span>打包下载 ZIP</span>
              </button>
              <button class="button button-secondary" type="button" data-retry-failed hidden>
                <i data-lucide="RotateCcw"></i><span>重试失败文件</span>
              </button>
              <button class="button button-secondary" type="button" data-reset><i data-lucide="RefreshCw"></i><span>转换另一个</span></button>
            </div>
          </div>
        </div>
        <div class="video-workbench" data-video-workbench hidden></div>
        <div class="pdf-workbench" data-pdf-workbench hidden></div>

        <div class="local-note">
          <i data-lucide="ShieldCheck"></i>
          <span>本地处理</span>
          <span class="local-note-detail">原文件不离开设备；最近 10 条结果保存在此浏览器，可随时清除。</span>
        </div>
      </div>
    </section>

    <section class="history-band" aria-labelledby="history-title">
      <div class="history-inner">
        <div class="history-heading">
          <div><h2 id="history-title">最近转换</h2></div>
          <button class="button button-secondary" type="button" data-clear-history hidden>
            <i data-lucide="Trash2"></i><span>清空记录</span>
          </button>
        </div>
        <p class="history-note">转换结果保存在当前浏览器，不会同步到其他设备。</p>
        <div class="history-list" data-history-list aria-live="polite"></div>
      </div>
    </section>
  </main>

  <footer><span>格式工坊</span><span>文件仅在本地处理</span></footer>
`;
