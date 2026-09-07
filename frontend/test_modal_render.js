import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

async function testModalRender() {
  console.log('----------------------------------------------------');
  console.log('KIỂM THỬ RENDER THỰC TẾ: AuditProgressModal.jsx');
  console.log('----------------------------------------------------');
  
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    const { default: AuditProgressModal } = await server.ssrLoadModule('/src/components/modals/AuditProgressModal.jsx');

    console.log('[1/2] Kiểm thử trạng thái: status = running...');
    const htmlRunning = renderToStaticMarkup(React.createElement(AuditProgressModal, {
      isOpen: true,
      status: 'running',
      activeStep: 2,
      keyword: '908531',
      item: { ten_vt: 'Module Test' }
    }));
    console.log(' -> Trạng thái running: OK (Độ dài HTML:', htmlRunning.length, 'ký tự)');

    console.log('[2/2] Kiểm thử trạng thái: status = completed (Trạng thái vừa gây lỗi)...');
    const mockAudit = {
      item_id: 1,
      ten_vt: 'Module đầu vào input IUX 760 MI',
      keyword_used: '908531',
      don_gia_trinh: 13559000,
      don_gia_thong_nhat: 13559000,
      pct_giam: 0,
      gia_tri_giam: 0,
      steps: [
        { name: '1. Báo Giá Gốc', status: 'success', price: 13559000, detail: 'Báo giá Minimax' },
        { name: '2. ERP Vĩnh Tân 4', status: 'empty', price: 0, detail: 'Chưa có' },
        { name: '3. EVN IMIS', status: 'empty', price: 0, detail: 'Chưa có' },
        { name: '4. MSC e-GP', status: 'empty', price: 0, detail: 'Chưa có' },
        { name: '5. TMĐT', status: 'info', price: 0, detail: 'Liên hệ' },
        { name: '6. AI Chốt Giá', status: 'success', price: 13559000, detail: 'Thống nhất' }
      ],
      synthesis: {
        coverage_score: 95,
        summary_text: 'Thống nhất theo giá thấp nhất.'
      }
    };

    const htmlCompleted = renderToStaticMarkup(React.createElement(AuditProgressModal, {
      isOpen: true,
      status: 'completed',
      activeStep: 6,
      keyword: '908531',
      item: { ten_vt: 'Module đầu vào input IUX 760 MI' },
      auditData: mockAudit
    }));
    console.log(' -> Trạng thái completed: OK (Độ dài HTML:', htmlCompleted.length, 'ký tự)');
    
    console.log('----------------------------------------------------');
    console.log('KẾT QUẢ: PASS! AuditProgressModal RENDER HOÀN HẢO, KHÔNG CÒN LỖI!');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('LỖI RENDER:', err);
    process.exit(1);
  } finally {
    await server.close();
  }
}

testModalRender();
