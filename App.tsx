import React, { useState } from 'react';
import { Wand2, Download, AlertCircle, Sparkles, Image as ImageIcon, ArrowRight, Zap, ScanEye, Edit3, Layers, Square, RectangleHorizontal, RectangleVertical, X, Loader2, CheckCircle2, Facebook, Copy, FolderArchive, Maximize2, RotateCcw, LayoutTemplate, Palette, ShoppingBag, RefreshCw, Grid2X2 } from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';
import { Button } from './components/Button';
import { Toggle } from './components/Toggle';
import { generateEditedImage } from './services/geminiService';
import { AppState, ProcessingItem, EditMode, AspectRatio } from './types';
import JSZip from 'jszip';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [editMode, setEditMode] = useState<EditMode>('background');
  const [isHighQuality, setIsHighQuality] = useState(false);
  const [focusOnProduct, setFocusOnProduct] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Banner specific state
  const [bannerTheme, setBannerTheme] = useState('Sale Promotion');
  const [bannerStyle, setBannerStyle] = useState('Modern & Minimalist');

  const bannerThemes = [
    "Khuyến mãi lớn (Big Sale)", "Ra mắt sản phẩm mới", "Tết Holiday", "Giáng sinh (Christmas)", "Mùa hè sôi động", "Sang trọng & Cao cấp", "Thiên nhiên & Organic"
  ];
  
  const bannerStyles = [
    "Tối giản (Minimalist)", "Rực rỡ (Vibrant)", "Màu pastel nhẹ nhàng", "Neon Cyberpunk", "Studio chuyên nghiệp", "Nền màu đơn sắc (Solid Color)"
  ];

  const handleImagesSelected = (newFiles: any[]) => {
    const newItems: ProcessingItem[] = newFiles.map(file => ({
      ...file,
      status: 'IDLE'
    }));
    setItems(prev => [...prev, ...newItems]);
    if (appState === AppState.SUCCESS) setAppState(AppState.IDLE);
    setGlobalError(null);
  };

  const removeImage = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const duplicateImage = (id: string) => {
    if (items.length >= 10) {
      return; // Max limit reached handled by UI state usually, but good safeguard
    }

    setItems(prev => {
       if (prev.length >= 10) return prev;
       
       const itemToDuplicate = prev.find(item => item.id === id);
       if (!itemToDuplicate) return prev;

       const newItem: ProcessingItem = {
         ...itemToDuplicate,
         id: crypto.randomUUID(), // New unique ID
         status: 'IDLE',          // Reset status
         results: undefined,      // Clear result
         error: undefined         // Clear error
       };
       
       return [...prev, newItem];
    });

    if (appState === AppState.SUCCESS) setAppState(AppState.IDLE);
    setGlobalError(null);
  };

  const handleRetry = async (id: string) => {
    const item = items.find(i => i.id === id);
    // Combine prompt for banner mode
    const finalPrompt = editMode === 'banner' 
      ? `Theme: ${bannerTheme}. Style: ${bannerStyle}. ${prompt}` 
      : prompt;

    if (!item || (!finalPrompt.trim() && editMode !== 'banner')) return;

    setAppState(AppState.GENERATING);
    
    // Set specific item to generating
    setItems(prev => prev.map(i => 
      i.id === id ? { ...i, status: 'GENERATING', error: undefined, results: undefined } : i
    ));

    try {
      // Create an array of promises based on generateCount
      const promises = Array(generateCount).fill(null).map(() => 
        generateEditedImage(
          item.base64,
          item.mimeType,
          finalPrompt,
          editMode,
          isHighQuality,
          focusOnProduct,
          aspectRatio
        )
      );

      const newResults = await Promise.all(promises);

      setItems(prev => prev.map(i => 
        i.id === id 
          ? { ...i, status: 'SUCCESS', results: newResults } 
          : i
      ));
    } catch (err: any) {
      console.error(`Error retrying item ${id}:`, err);
      let errorMessage = "Lỗi xử lý.";
      if (err.message?.includes("Requested entity was not found")) {
          errorMessage = "Lỗi API Key.";
      } else if (err.message) {
          errorMessage = err.message;
      }

      setItems(prev => prev.map(i => 
        i.id === id 
          ? { ...i, status: 'ERROR', error: errorMessage } 
          : i
      ));
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const handleGenerate = async () => {
    // Construct effective prompt
    const finalPrompt = editMode === 'banner' 
      ? `Theme: ${bannerTheme}. Style: ${bannerStyle}. Extra details: ${prompt}` 
      : prompt;

    if (items.length === 0 || !finalPrompt.trim()) return;

    const aiStudio = (window as any).aistudio;
    // Check for API key if High Quality is selected
    if (isHighQuality && aiStudio) {
      try {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
          await aiStudio.openSelectKey();
        }
      } catch (err) {
        console.warn("Could not check/request API key:", err);
      }
    }

    setAppState(AppState.GENERATING);
    setGlobalError(null);

    // Update status of all idle items to generating
    setItems(prev => prev.map(item => 
      item.status === 'SUCCESS' ? item : { ...item, status: 'GENERATING', error: undefined, results: undefined }
    ));

    // Process items in parallel
    const itemsToProcess = items.filter(item => item.status !== 'SUCCESS');

    await Promise.all(itemsToProcess.map(async (item) => {
      try {
        // Run parallel requests for generateCount
        const promises = Array(generateCount).fill(null).map(() => 
          generateEditedImage(
            item.base64,
            item.mimeType,
            finalPrompt,
            editMode,
            isHighQuality,
            focusOnProduct,
            aspectRatio
          )
        );

        const newResults = await Promise.all(promises);
        
        setItems(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, status: 'SUCCESS', results: newResults } 
            : i
        ));
      } catch (err: any) {
        console.error(`Error processing item ${item.id}:`, err);
        let errorMessage = "Lỗi xử lý.";
        if (err.message?.includes("Requested entity was not found")) {
            errorMessage = "Lỗi API Key.";
        } else if (err.message) {
            errorMessage = err.message;
        }

        setItems(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, status: 'ERROR', error: errorMessage } 
            : i
        ));
      }
    }));

    setAppState(AppState.SUCCESS);
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setItems([]);
    setPrompt('');
    setGlobalError(null);
  };

  const handleDownloadSingle = (url: string, index: number, subIndex: number = 0) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `gemini-edit-${index}-${subIndex}-${editMode}-${aspectRatio.replace(':','-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    const successfulItems = items.filter(i => i.status === 'SUCCESS' && i.results && i.results.length > 0);
    if (successfulItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      successfulItems.forEach((item, idx) => {
        if (item.results) {
          item.results.forEach((url, subIdx) => {
            const base64Data = url.split(',')[1];
            const fileName = `gemini_result_${idx + 1}_v${subIdx + 1}_${Date.now()}.png`;
            zip.file(fileName, base64Data, { base64: true });
          });
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Gemini_Batch_Result_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Zip error:", error);
      alert("Đã xảy ra lỗi khi tạo file nén.");
    } finally {
      setIsZipping(false);
    }
  };

  // Derived state for successful items count
  const successfulCount = items.filter(i => i.status === 'SUCCESS').length;

  return (
    <div className="min-h-screen relative overflow-x-hidden text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background Image Layer */}
      <div className="fixed inset-0 z-[-1]">
        <img 
          src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2072&auto=format&fit=crop"
          alt="App Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 relative z-10">
        
        {/* Header */}
        <header className="mb-12 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-2 mb-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-indigo-300 mr-2" />
            <span className="text-sm font-medium text-indigo-200 uppercase tracking-wider">Powered by Gemini 2.5 & 3 Pro</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-200 tracking-tight drop-shadow-sm">
            AI Image Magic
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto font-light">
            Biến đổi hàng loạt hình ảnh của bạn với sức mạnh AI. Thay đổi hình nền, tạo banner quảng cáo hoặc chỉnh sửa chi tiết.
          </p>

          <div className="pt-4 flex justify-center">
            <a 
              href="https://www.facebook.com/mactri97"
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 ring-1 ring-blue-500/50"
            >
              <Facebook className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
              <span>LIÊN HỆ CÀI ĐẶT PHẦN MỀM</span>
            </a>
          </div>
        </header>

        <main>
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Input & Config (Span 5) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-xs font-bold mr-3 shadow-lg shadow-indigo-500/30">1</span>
                    Upload Ảnh
                  </h2>
                  <span className="text-xs text-slate-400 font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700">
                    {items.length} / 10
                  </span>
                </div>
                
                <ImageUpload 
                  onImagesSelected={handleImagesSelected} 
                  currentCount={items.length}
                  maxFiles={10}
                />

                {/* Uploaded Images Grid */}
                {items.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {items.map((item) => (
                      <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                        <img 
                          src={item.previewUrl} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Action Buttons */}
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <button 
                            onClick={(e) => { e.stopPropagation(); duplicateImage(item.id); }}
                            disabled={appState === AppState.GENERATING || items.length >= 10}
                            className="p-1.5 bg-indigo-500/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Nhân bản ảnh này"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeImage(item.id); }}
                            disabled={appState === AppState.GENERATING}
                            className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Xóa ảnh"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Status Icons */}
                        {item.status === 'SUCCESS' && (
                           <div className="absolute bottom-1 right-1 pointer-events-none">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow-md" />
                           </div>
                        )}
                        {item.status === 'ERROR' && (
                           <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center pointer-events-none">
                              <AlertCircle className="w-6 h-6 text-red-400" />
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8">
                   <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-xs font-bold mr-3 shadow-lg shadow-indigo-500/30">2</span>
                    Cấu hình
                  </h2>
                  
                  <div className="space-y-4">
                    {/* Mode Switcher */}
                    <div className="grid grid-cols-3 gap-2 p-1 bg-slate-800/60 rounded-xl border border-slate-700">
                      <button
                        onClick={() => setEditMode('background')}
                        className={`flex flex-col md:flex-row items-center justify-center py-2.5 px-1 text-xs md:text-sm font-medium rounded-lg transition-all ${
                          editMode === 'background' 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <Layers className="w-4 h-4 md:mr-2 mb-1 md:mb-0" />
                        Đổi nền
                      </button>
                      <button
                        onClick={() => {
                          setEditMode('banner');
                          if (aspectRatio === '1:1') setAspectRatio('16:9'); // Auto-switch for better UX
                        }}
                        className={`flex flex-col md:flex-row items-center justify-center py-2.5 px-1 text-xs md:text-sm font-medium rounded-lg transition-all ${
                          editMode === 'banner' 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <LayoutTemplate className="w-4 h-4 md:mr-2 mb-1 md:mb-0" />
                        Tạo Banner
                      </button>
                      <button
                        onClick={() => setEditMode('custom')}
                        className={`flex flex-col md:flex-row items-center justify-center py-2.5 px-1 text-xs md:text-sm font-medium rounded-lg transition-all ${
                          editMode === 'custom' 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <Edit3 className="w-4 h-4 md:mr-2 mb-1 md:mb-0" />
                        Tự do
                      </button>
                    </div>

                    {/* Conditional Input Fields */}
                    {editMode === 'banner' ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                            <ShoppingBag className="w-4 h-4 mr-2 text-indigo-400" />
                            Chủ đề (Theme)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {bannerThemes.map(theme => (
                              <button
                                key={theme}
                                onClick={() => setBannerTheme(theme)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                  bannerTheme === theme
                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {theme}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                             <Palette className="w-4 h-4 mr-2 text-indigo-400" />
                             Phong cách (Style)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {bannerStyles.map(style => (
                              <button
                                key={style}
                                onClick={() => setBannerStyle(style)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                  bannerStyle === style
                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="relative">
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Mô tả thêm (Tùy chọn)
                          </label>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ví dụ: Thêm lá cọ ở góc, tông màu cam chủ đạo..."
                            className="w-full h-20 bg-slate-800/50 text-slate-100 placeholder-slate-400 border border-slate-600 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-sm shadow-inner"
                            disabled={appState === AppState.GENERATING}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          {editMode === 'background' ? 'Mô tả hình nền mới' : 'Mô tả chỉnh sửa (Prompt)'}
                        </label>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={
                            editMode === 'background' 
                            ? "Ví dụ: bãi biển hoàng hôn, văn phòng hiện đại, khu rừng thần tiên..."
                            : "Ví dụ: Thêm kính râm cho chú mèo, đổi màu áo thành đỏ, làm cho trời mưa..."
                          }
                          className="w-full h-28 bg-slate-800/50 text-slate-100 placeholder-slate-400 border border-slate-600 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-base shadow-inner"
                          disabled={appState === AppState.GENERATING}
                        />
                      </div>
                    )}
                    
                    {/* Aspect Ratio & Quantity Selector */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Tỉ lệ khung hình</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['1:1', '16:9', '9:16'] as AspectRatio[]).map((ratio) => (
                             <button
                             key={ratio}
                             onClick={() => setAspectRatio(ratio)}
                             className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                               aspectRatio === ratio
                               ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 shadow-sm'
                               : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-700/60 hover:border-slate-600'
                             }`}
                           >
                             {ratio === '1:1' && <Square className="w-5 h-5 mb-1" />}
                             {ratio === '16:9' && <RectangleHorizontal className="w-5 h-5 mb-1" />}
                             {ratio === '9:16' && <RectangleVertical className="w-5 h-5 mb-1" />}
                             <span className="text-xs font-medium">{ratio}</span>
                           </button>
                          ))}
                        </div>
                      </div>

                      <div>
                         <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                            <Grid2X2 className="w-4 h-4 mr-1" />
                            Số lượng kết quả
                          </label>
                         <div className="grid grid-cols-4 gap-2">
                            {[1, 2, 3, 4].map((num) => (
                              <button
                                key={num}
                                onClick={() => setGenerateCount(num)}
                                className={`flex items-center justify-center p-2 rounded-xl border transition-all h-[62px] ${
                                  generateCount === num
                                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 font-bold shadow-sm text-lg'
                                  : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-700/60 hover:border-slate-600'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                         </div>
                      </div>
                    </div>

                    <div className="grid gap-3 pt-2">
                      <Toggle 
                        checked={focusOnProduct}
                        onChange={setFocusOnProduct}
                        label="Tăng cường chi tiết sản phẩm"
                        description="Giữ nguyên và làm nét chủ thể, tối ưu ánh sáng studio."
                      />
                      
                      <Toggle 
                        checked={isHighQuality}
                        onChange={setIsHighQuality}
                        label="Chất lượng 2K (High Quality)"
                        description="Sử dụng Gemini 3 Pro. Yêu cầu API Key trả phí."
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <Button 
                    onClick={handleGenerate}
                    disabled={items.length === 0 || (editMode !== 'banner' && !prompt.trim()) || appState === AppState.GENERATING}
                    isLoading={appState === AppState.GENERATING}
                    className="w-full text-lg shadow-xl shadow-indigo-900/20"
                    icon={<Wand2 className="w-5 h-5" />}
                  >
                    {appState === AppState.GENERATING ? `Đang xử lý ${items.length} ảnh (${generateCount} phiên bản)...` : (editMode === 'banner' ? 'Tạo Banner' : (editMode === 'background' ? 'Tạo hình nền' : 'Tạo chỉnh sửa'))}
                  </Button>
                  
                  {items.length > 0 && appState !== AppState.GENERATING && (
                     <Button 
                        variant="outline"
                        onClick={handleReset}
                        className="px-4"
                     >
                       <X className="w-5 h-5" />
                     </Button>
                  )}
                </div>

                {globalError && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{globalError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Result List (Span 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl h-full min-h-[600px] flex flex-col">
                <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <Sparkles className="w-6 h-6 text-indigo-400 mr-3" />
                    Thư viện Kết quả
                  </h2>
                  
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {successfulCount > 1 && (
                      <Button
                        variant="primary"
                        onClick={handleDownloadAll}
                        isLoading={isZipping}
                        className="px-3 py-1.5 h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                        icon={<FolderArchive className="w-3 h-3" />}
                      >
                        Tải tất cả ZIP
                      </Button>
                    )}
                    
                     <span className="text-xs font-bold px-2 py-1 bg-slate-700/50 text-slate-300 rounded-md border border-slate-600">
                        {aspectRatio}
                      </span>
                    {focusOnProduct && (
                      <span className="text-xs font-bold px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30 flex items-center">
                        <ScanEye className="w-3 h-3 mr-1" /> Sharp
                      </span>
                    )}
                    {isHighQuality && (
                      <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
                        2K HD
                      </span>
                    )}
                  </div>
                </div>

                {/* Result Container */}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                  {items.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4 min-h-[400px]">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-slate-600" />
                        </div>
                        <p className="text-slate-400">Tải ảnh lên và nhấn tạo để xem kết quả</p>
                     </div>
                  ) : (
                    <div className="space-y-6">
                      {items.map((item, idx) => (
                        <div key={item.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-700">
                          
                          {/* Item Header / Status */}
                          <div className="flex items-center justify-between mb-3 text-sm">
                             <span className="text-slate-400 font-mono text-xs truncate max-w-[200px]">{item.file.name}</span>
                             
                             {item.status === 'GENERATING' && (
                               <span className="flex items-center text-indigo-400 text-xs animate-pulse">
                                 <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang xử lý...
                               </span>
                             )}
                             {item.status === 'SUCCESS' && (
                               <span className="flex items-center text-emerald-400 text-xs">
                                 <CheckCircle2 className="w-3 h-3 mr-1" /> Hoàn tất ({item.results?.length} ảnh)
                               </span>
                             )}
                             {item.status === 'ERROR' && (
                               <span className="flex items-center text-red-400 text-xs">
                                 <AlertCircle className="w-3 h-3 mr-1" /> Lỗi
                               </span>
                             )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* Original */}
                             <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group h-fit">
                                <img src={item.previewUrl} className="w-full h-full object-contain" alt="Original" />
                                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] text-white font-medium">Gốc</div>
                             </div>

                             {/* Result */}
                             <div className={`relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center min-h-[200px] ${item.results && item.results.length > 1 ? 'p-2' : ''}`}>
                                {item.status === 'SUCCESS' && item.results && item.results.length > 0 ? (
                                  item.results.length === 1 ? (
                                    // Single Image Display
                                    <div className="w-full h-full relative group aspect-video">
                                       <img src={item.results[0]} className="w-full h-full object-contain" alt="Result" />
                                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                          <Button
                                              variant="secondary" 
                                              className="scale-90 px-3"
                                              onClick={() => setPreviewUrl(item.results![0])}
                                              title="Xem chi tiết"
                                          >
                                              <Maximize2 className="w-4 h-4" />
                                          </Button>
                                          <Button 
                                            variant="primary" 
                                            className="scale-90 px-3"
                                            onClick={() => handleDownloadSingle(item.results![0], idx)}
                                            title="Tải về"
                                          >
                                            <Download className="w-4 h-4" />
                                          </Button>
                                          <Button 
                                            variant="secondary" 
                                            className="scale-90 px-3 bg-indigo-600/80 hover:bg-indigo-600 border-indigo-500/50"
                                            onClick={() => handleRetry(item.id)}
                                            title="Tạo lại"
                                          >
                                            <RefreshCw className="w-4 h-4 text-white" />
                                          </Button>
                                       </div>
                                    </div>
                                  ) : (
                                    // Grid Display for Multiple Images
                                    <div className="w-full h-full grid grid-cols-2 gap-2">
                                       {item.results.map((resUrl, subIdx) => (
                                          <div key={subIdx} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                                            <img src={resUrl} className="w-full h-full object-cover" alt={`Result ${subIdx + 1}`} />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <div className="flex gap-1">
                                                  <button
                                                      className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-full"
                                                      onClick={() => setPreviewUrl(resUrl)}
                                                      title="Xem"
                                                  >
                                                      <Maximize2 className="w-3 h-3" />
                                                  </button>
                                                  <button 
                                                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full"
                                                    onClick={() => handleDownloadSingle(resUrl, idx, subIdx)}
                                                    title="Tải về"
                                                  >
                                                    <Download className="w-3 h-3" />
                                                  </button>
                                                </div>
                                            </div>
                                            <span className="absolute bottom-1 right-1 text-[10px] bg-black/50 text-white px-1.5 rounded">{subIdx + 1}</span>
                                          </div>
                                       ))}
                                       <div className="absolute top-1 right-1 z-10">
                                          <Button 
                                            variant="secondary" 
                                            className="h-6 px-2 text-[10px] bg-indigo-600/90 hover:bg-indigo-500 border-none shadow-lg"
                                            onClick={() => handleRetry(item.id)}
                                            title="Tạo lại bộ này"
                                          >
                                            <RefreshCw className="w-3 h-3 mr-1 text-white" /> Tạo lại
                                          </Button>
                                       </div>
                                    </div>
                                  )
                                ) : item.status === 'GENERATING' ? (
                                   <div className="flex flex-col items-center">
                                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                                      <span className="text-xs text-slate-500">Đang tạo {generateCount} ảnh...</span>
                                   </div>
                                ) : item.status === 'ERROR' ? (
                                   <div className="text-center p-4 flex flex-col items-center gap-2">
                                      <p className="text-xs text-red-300">{item.error || 'Thất bại'}</p>
                                      <Button 
                                        variant="secondary" 
                                        className="h-8 px-3 text-xs bg-slate-800/80 hover:bg-slate-700"
                                        onClick={() => handleRetry(item.id)}
                                        icon={<RotateCcw className="w-3 h-3" />}
                                      >
                                        Thử lại
                                      </Button>
                                   </div>
                                ) : (
                                  <div className="text-slate-600 text-xs">Chờ xử lý</div>
                                )}
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
            
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-20 text-center border-t border-slate-800/50 pt-8">
           <div className="flex flex-col md:flex-row justify-center items-center gap-6 text-sm text-slate-400">
              <p>© {new Date().getFullYear()} AI Image Magic</p>
              <span className="hidden md:inline w-1 h-1 bg-slate-700 rounded-full"></span>
              <p>Powered by Google Gemini API</p>
           </div>
        </footer>

        {/* Image Preview Modal */}
        {previewUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewUrl(null)}
          >
            <button 
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-8 h-8" />
            </button>
            
            <img 
              src={previewUrl} 
              alt="Full Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;