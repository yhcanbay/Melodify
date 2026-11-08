#define _GNU_SOURCE
#include <jni.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

// Only process groups created here may be signaled. This API is not exposed to JS.
static pthread_mutex_t groups_lock = PTHREAD_MUTEX_INITIALIZER;
static pid_t groups[16];

static void fail(JNIEnv *env, const char *message) {
    jclass exception = (*env)->FindClass(env, "java/io/IOException");
    if (exception) (*env)->ThrowNew(env, exception, message);
}

static int group_slot(pid_t pid) {
    for (int i = 0; i < 16; i++) if (groups[i] == pid) return i;
    return -1;
}

static char *copy_bytes(JNIEnv *env, jbyteArray value) {
    if (!value) return NULL;
    jsize length = (*env)->GetArrayLength(env, value);
    if (length > 1048576) return NULL;
    char *result = calloc((size_t) length + 1, 1);
    if (result) (*env)->GetByteArrayRegion(env, value, 0, length, (jbyte *) result);
    return result;
}

static char **copy_arguments(JNIEnv *env, jobjectArray values) {
    jsize length = (*env)->GetArrayLength(env, values);
    if (length < 1 || length > 256) return NULL;
    char **result = calloc((size_t) length + 1, sizeof(char *));
    if (!result) return NULL;
    for (int i = 0; i < length; i++) {
        jbyteArray value = (*env)->GetObjectArrayElement(env, values, i);
        result[i] = copy_bytes(env, value);
        (*env)->DeleteLocalRef(env, value);
        if (!result[i]) {
            for (int j = 0; j < i; j++) free(result[j]);
            free(result);
            return NULL;
        }
    }
    return result;
}

static void free_arguments(char **values) {
    if (!values) return;
    for (int i = 0; values[i]; i++) free(values[i]);
    free(values);
}

JNIEXPORT jintArray JNICALL
Java_com_yhcanbay_melodify_downloads_NativeProcess_spawn(
    JNIEnv *env, jobject self, jobjectArray arguments, jobjectArray environment, jbyteArray directory
) {
    (void) self;
    char **argv = copy_arguments(env, arguments);
    char **envp = copy_arguments(env, environment);
    char *cwd = copy_bytes(env, directory);
    int output[2] = {-1, -1}, error[2] = {-1, -1}, ready[2] = {-1, -1};
    int slot = -1;
    pid_t pid = -1;
    if (!argv || !envp || !cwd || argv[0][0] != '/') goto failed;
    pthread_mutex_lock(&groups_lock);
    slot = group_slot(0);
    if (slot >= 0) groups[slot] = -1;
    pthread_mutex_unlock(&groups_lock);
    if (slot < 0 || pipe2(output, O_CLOEXEC) || pipe2(error, O_CLOEXEC) || pipe2(ready, O_CLOEXEC)) goto failed;

    pid = fork();
    if (pid == 0) {
        // After fork, use only async-signal-safe libc calls until execve.
        close(output[0]); close(error[0]); close(ready[0]);
        if (setsid() < 0 || chdir(cwd) < 0 || dup2(output[1], STDOUT_FILENO) < 0 || dup2(error[1], STDERR_FILENO) < 0) _exit(126);
        int input = open("/dev/null", O_RDONLY);
        if (input < 0 || dup2(input, STDIN_FILENO) < 0) _exit(126);
        close(input); close(output[1]); close(error[1]);
        char marker = 'R';
        if (write(ready[1], &marker, 1) != 1) _exit(126);
        close(ready[1]);
        execve(argv[0], argv, envp);
        const char message[] = "Melodify: tool execution failed.\n";
        write(STDERR_FILENO, message, sizeof(message) - 1);
        _exit(127);
    }
    if (pid < 0) goto failed;
    close(output[1]); output[1] = -1;
    close(error[1]); error[1] = -1;
    close(ready[1]); ready[1] = -1;
    char marker = 0;
    ssize_t count;
    do { count = read(ready[0], &marker, 1); } while (count < 0 && errno == EINTR);
    if (count != 1 || marker != 'R') goto failed;
    close(ready[0]); ready[0] = -1;
    pthread_mutex_lock(&groups_lock);
    groups[slot] = pid;
    pthread_mutex_unlock(&groups_lock);
    jintArray result = (*env)->NewIntArray(env, 3);
    if (!result) goto failed;
    jint values[] = {pid, output[0], error[0]};
    (*env)->SetIntArrayRegion(env, result, 0, 3, values);
    free_arguments(argv); free_arguments(envp); free(cwd);
    return result;

failed:
    if (pid > 0) {
        kill(-pid, SIGKILL);
        kill(pid, SIGKILL);
        while (waitpid(pid, NULL, 0) < 0 && errno == EINTR) {}
    }
    if (slot >= 0) {
        pthread_mutex_lock(&groups_lock);
        groups[slot] = 0;
        pthread_mutex_unlock(&groups_lock);
    }
    for (int i = 0; i < 2; i++) {
        if (output[i] >= 0) close(output[i]);
        if (error[i] >= 0) close(error[i]);
        if (ready[i] >= 0) close(ready[i]);
    }
    free_arguments(argv); free_arguments(envp); free(cwd);
    if (!(*env)->ExceptionCheck(env)) fail(env, "Melodify process group could not be started.");
    return NULL;
}

JNIEXPORT jint JNICALL
Java_com_yhcanbay_melodify_downloads_NativeProcess_waitExit(JNIEnv *env, jobject self, jint pid) {
    (void) self;
    pthread_mutex_lock(&groups_lock);
    int owned = pid > 0 && group_slot(pid) >= 0;
    pthread_mutex_unlock(&groups_lock);
    if (!owned) { fail(env, "Unknown Melodify process group."); return -1; }
    int status;
    pid_t result;
    do { result = waitpid(pid, &status, 0); } while (result < 0 && errno == EINTR);
    if (result < 0) { fail(env, "Melodify process could not be reaped."); return -1; }
    return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}

JNIEXPORT jboolean JNICALL
Java_com_yhcanbay_melodify_downloads_NativeProcess_groupAlive(JNIEnv *env, jobject self, jint pid) {
    (void) env; (void) self;
    pthread_mutex_lock(&groups_lock);
    int alive = pid > 0 && group_slot(pid) >= 0 && (kill(-pid, 0) == 0 || errno == EPERM);
    pthread_mutex_unlock(&groups_lock);
    return alive ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_yhcanbay_melodify_downloads_NativeProcess_stopGroup(JNIEnv *env, jobject self, jint pid) {
    (void) self;
    pthread_mutex_lock(&groups_lock);
    int slot = pid > 0 ? group_slot(pid) : -1;
    int result = slot >= 0 ? kill(-pid, SIGKILL) : 0;
    int saved_errno = errno;
    pthread_mutex_unlock(&groups_lock);
    if (result < 0 && saved_errno != ESRCH) fail(env, "Melodify process group could not be stopped.");
}

JNIEXPORT void JNICALL
Java_com_yhcanbay_melodify_downloads_NativeProcess_release(JNIEnv *env, jobject self, jint pid) {
    (void) env; (void) self;
    pthread_mutex_lock(&groups_lock);
    int slot = pid > 0 ? group_slot(pid) : -1;
    if (slot >= 0) {
        kill(-pid, SIGKILL);
        groups[slot] = 0;
    }
    pthread_mutex_unlock(&groups_lock);
}
