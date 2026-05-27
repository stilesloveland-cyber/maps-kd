import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Annotation, CreateAnnotationRequest, UpdateAnnotationRequest } from '../types';

interface AnnotationModalProps {
  annotation: Annotation | null;
  onSave: (data: CreateAnnotationRequest | UpdateAnnotationRequest) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ annotation, onSave, onDelete, onClose }) => {
  const [text, setText] = useState(annotation?.text || '');
  const [fontSize, setFontSize] = useState(annotation?.fontSize || 14);
  const [textColor, setTextColor] = useState(annotation?.textColor || '#1e293b');
  const [bgColor, setBgColor] = useState(annotation?.bgColor || '#ffffff');

  useEffect(() => {
    if (annotation) {
      setText(annotation.text);
      setFontSize(annotation.fontSize);
      setTextColor(annotation.textColor);
      setBgColor(annotation.bgColor);
    }
  }, [annotation]);

  const handleSave = () => {
    if (!text.trim()) return;
    const data: UpdateAnnotationRequest = { text: text.trim(), fontSize, textColor, bgColor };
    if (annotation) {
      if (annotation.x !== undefined) data.x = annotation.x;
      if (annotation.y !== undefined) data.y = annotation.y;
    }
    onSave(data);
  };

  return (
    <div className="ann-modal-overlay" onClick={onClose}>
      <div className="ann-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ann-modal-header">
          <span className="ann-modal-title">{annotation ? '编辑注释' : '新建注释'}</span>
          <button className="ann-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ann-modal-body">
          <div className="ann-field">
            <label className="ann-label">文字内容</label>
            <textarea className="ann-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入注释文字..." />
          </div>
          <div className="ann-field-row">
            <div className="ann-field">
              <label className="ann-label">字体大小</label>
              <input type="number" className="ann-input" min={10} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
            </div>
            <div className="ann-field">
              <label className="ann-label">文字颜色</label>
              <input type="color" className="ann-color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </div>
            <div className="ann-field">
              <label className="ann-label">背景色</label>
              <input type="color" className="ann-color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ann-modal-footer">
          {annotation && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(annotation.id)}>删除</button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!text.trim()}>保存</button>
        </div>
      </div>
      <style>{`
        .ann-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center; z-index: 200;
          animation: fadeIn 0.15s ease;
        }
        .ann-modal {
          background: #fff; border-radius: 16px; width: 420px; max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15); animation: slideUp 0.2s ease;
        }
        .ann-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 0;
        }
        .ann-modal-title { font-weight: 700; font-size: 17px; color: #1e293b; }
        .ann-modal-close { padding: 4px; border-radius: 8px; color: #94a3b8; transition: all 0.15s; }
        .ann-modal-close:hover { background: #f1f5f9; color: #475569; }
        .ann-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .ann-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .ann-field-row { display: flex; gap: 12px; }
        .ann-label { font-size: 13px; font-weight: 600; color: #475569; }
        .ann-textarea {
          padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-size: 14px; outline: none; resize: vertical; font-family: inherit;
          transition: border-color 0.15s;
        }
        .ann-textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .ann-input {
          padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
        }
        .ann-input:focus { border-color: #3b82f6; }
        .ann-color { width: 40px; height: 36px; padding: 2px; border: 1.5px solid #e2e8f0; border-radius: 8px; cursor: pointer; }
        .ann-modal-footer {
          display: flex; align-items: center; gap: 8px; padding: 16px 24px 20px;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 767px) {
          .ann-modal { width: 100%; max-width: 100vw; border-radius: 16px 16px 0 0; margin: auto 0 0 0; animation: slideUpMobile 0.25s ease; }
          .ann-modal-overlay { align-items: flex-end; }
          @keyframes slideUpMobile { from { transform: translateY(100%); } to { transform: translateY(0); } }
        }
      `}</style>
    </div>
  );
};

export default AnnotationModal;
