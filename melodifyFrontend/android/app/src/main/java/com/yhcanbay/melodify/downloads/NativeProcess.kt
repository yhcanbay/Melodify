package com.yhcanbay.melodify.downloads

object NativeProcess {
    init { System.loadLibrary("melodify_process") }

    external fun spawn(arguments: Array<ByteArray>, environment: Array<ByteArray>, directory: ByteArray): IntArray
    external fun waitExit(pid: Int): Int
    external fun groupAlive(pid: Int): Boolean
    external fun stopGroup(pid: Int)
    external fun release(pid: Int)
}
