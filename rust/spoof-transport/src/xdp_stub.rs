//! Raw-socket builds expose the same ABI without requiring a nightly eBPF compiler.
use std::ffi::c_void;
#[no_mangle]
pub extern "C" fn spoof_xdp_available() -> i32 { 0 }
#[no_mangle]
pub extern "C" fn spoof_xdp_receiver_new(_: *const libc::c_char, _: *const u8, _: u16, _: u8) -> *mut c_void { std::ptr::null_mut() }
#[no_mangle]
pub extern "C" fn spoof_xdp_receiver_recv(_: *mut c_void, _: *mut u8, _: usize, _: *mut u8, _: *mut u16) -> i32 { -1 }
#[no_mangle]
pub extern "C" fn spoof_xdp_receiver_close(_: *mut c_void) {}
