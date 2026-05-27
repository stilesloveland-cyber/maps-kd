import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';
import type { Tag } from '../types';

interface BatchModalProps {
  tags: Tag[];
  onConfirm: (count: number, tagId: string) => void;
  onClose: () => void;
}

const BatchModal: React.FC<BatchModalProps> = ({ tags, onConfirm, onClose }) => {
  const [count, setCount] = useState<number>(10);
  const [tagId, setTagId] = useState<string>(tags.length > 0 ? tags[0].id : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (count < 1 || count > 50) return;
    if (!tagId) return;
    onConfirm(count, tagId);
  };

  return (
    <div className="batch-modal-overlay" onClick={onClose}>
      <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="batch-modal-header">
          <div className="batch-modal-title">
            <Layers size={20} />
            <span>批量生成柜机</span>
          </div>
          <button className="batch-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="batch-modal-body">
            <div className="batch-form-group">
              <label className="batch-form-label">生成数量</label>
              <input
                type="number"
                className="batch-form-input"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              />
              <span className="batch-form-hint">1 ~ 50 个</span>
            </div>
            <div className="batch-form-group">
              <label className="batch-form-label">选择标签</label>
              <select
                className="batch-form-select"
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
              >
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="batch-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!tagId}>
              确认生成
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .batch-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          animation: fadeIn 0.15s ease;
        }
        .batch-modal {
          background: #fff;
          border-radius: 16px;
          width: 380px;
          max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          animation: slideUp 0.2s ease;
        }
        .batch-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 0;
        }
        .batch-modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 17px;
          color: #1e293b;
        }
        .batch-modal-close {
          padding: 4px;
          border-radius: 8px;
          color: #94a3b8;
          transition: all 0.15s;
        }
        .batch-modal-close:hover {
          background: #f1f5f9;
          color: #475569;
        }
        .batch-modal-body {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .batch-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .batch-form-label {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .batch-form-input {
          padding: 10px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }
        .batch-form-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .batch-form-select {
          padding: 10px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s;
          background: #fff;
          width: 100%;
          box-sizing: border-box;
          cursor: pointer;
        }
        .batch-form-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .batch-form-hint {
          font-size: 12px;
          color: #94a3b8;
        }
        .batch-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 24px 20px;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 767px) {
          .batch-modal {
            width: 100%;
            max-width: 100vw;
            border-radius: 16px 16px 0 0;
            margin: auto 0 0 0;
            animation: slideUpMobile 0.25s ease;
          }
          .batch-modal-overlay {
            align-items: flex-end;
          }
          @keyframes slideUpMobile {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  );
};

export default BatchModal;
