'use client';

import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
});

export function toastSuccess(title: string) {
  return Toast.fire({ icon: 'success', title });
}

export function alertError(text: string, title = 'ไม่สามารถดำเนินการได้') {
  return Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#1c3d70', confirmButtonText: 'ตกลง' });
}

export function alertSuccess(text: string, title = 'สำเร็จ') {
  return Swal.fire({ icon: 'success', title, text, confirmButtonColor: '#1c3d70', confirmButtonText: 'ตกลง' });
}

export function confirmDelete(text = 'ต้องการลบรายการนี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้') {
  return Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบ',
    text,
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันลบ',
    cancelButtonText: 'ยกเลิก',
  });
}

export const dtThaiLang = {
  search: 'ค้นหา:',
  lengthMenu: 'แสดง _MENU_ รายการ',
  info: 'แสดง _START_ ถึง _END_ จากทั้งหมด _TOTAL_ รายการ',
  infoEmpty: 'ไม่พบข้อมูล',
  infoFiltered: '(กรองจากทั้งหมด _MAX_ รายการ)',
  zeroRecords: 'ไม่พบข้อมูลที่ตรงกับคำค้นหา',
  emptyTable: 'ไม่มีข้อมูลในตาราง',
  paginate: { first: 'แรก', last: 'สุดท้าย', next: 'ถัดไป', previous: 'ก่อนหน้า' },
};

export function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export { Swal };
