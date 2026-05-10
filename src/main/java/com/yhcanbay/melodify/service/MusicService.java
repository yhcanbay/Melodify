package com.yhcanbay.melodify.service;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

public class MusicService {

    // Muzik dosyalarinin okunacagi ana klasoru tek bir sabitte topluyoruz.
    private static final Path MUSIC_DIRECTORY = Path.of("C:\\Users\\yhcan\\OneDrive\\Music").normalize();
    // Basit oynatici icin destekleyecegimiz ses uzantilarini belirliyoruz.
    private static final List<String> SUPPORTED_EXTENSIONS = List.of(".mp3", ".wav", ".ogg", ".m4a", ".flac");

    // Frontend'de gostermek icin ana klasordeki muzik dosyalarini listeliyoruz.
    public List<String> listMusicFiles() throws IOException {
        // Ana klasor yoksa veya klasor degilse bos liste donuyoruz.
        if (!Files.isDirectory(MUSIC_DIRECTORY)) {
            return List.of();
        }

        // Klasoru tarayip sadece desteklenen normal dosyalari secerek isimlerini donuyoruz.
        try (Stream<Path> paths = Files.list(MUSIC_DIRECTORY)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(this::isSupportedAudioFile)
                    .map(path -> path.getFileName().toString())
                    .sorted(Comparator.naturalOrder())
                    .toList();
        }
    }

    // Verilen dosya adina gore muzigi okuyup HTTP response olarak donuyoruz.
    public Response getMusic(String fileName) throws IOException {
        // Kullanici girdisini ana klasore ekleyip normalize ediyoruz.
        Path audioPath = MUSIC_DIRECTORY.resolve(fileName).normalize();

        // Path traversal saldirilarini engellemek icin hedef yolun ana klasor altinda kaldigini kontrol ediyoruz.
        if (!audioPath.startsWith(MUSIC_DIRECTORY)) {
            // Ana klasor disina cikmaya calisan isteklerde 400 Bad Request donuyoruz.
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Gecersiz dosya yolu.")
                    .type(MediaType.TEXT_PLAIN)
                    .build();
        }

        // Hedefin gercekten var olan normal bir dosya oldugunu kontrol ediyoruz.
        if (!Files.isRegularFile(audioPath)) {
            // Dosya bulunamazsa veya klasor gelirse 404 Not Found donuyoruz.
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Dosya bulunamadi.")
                    .type(MediaType.TEXT_PLAIN)
                    .build();
        }

        // Dosyayi memory'e tamamen almadan parcali sekilde client'a aktaracak stream olusturuyoruz.
        StreamingOutput streamingOutput = new StreamingOutput() {
            @Override
            public void write(OutputStream output) throws IOException, WebApplicationException {
                // Input stream'i otomatik kapatmak icin try-with-resources kullaniyoruz.
                try (InputStream input = Files.newInputStream(audioPath)) {
                    // Dosyayi verimli okumak icin sabit boyutlu bir buffer tanimliyoruz.
                    byte[] buffer = new byte[8192];
                    // Her okumada gelen byte sayisini bu degiskende tutuyoruz.
                    int length;

                    // Dosya bitene kadar oku ve her parcayi response cikisina yaz.
                    while ((length = input.read(buffer)) != -1) {
                        output.write(buffer, 0, length);
                    }

                    // Son parcadan sonra cikis buffer'ini temizleyip veriyi istemciye gonderiyoruz.
                    output.flush();
                }
            }
        };

        // Frontend'in dosyayi dogru islemesi icin MIME type bilgisini tespit etmeye calisiyoruz.
        String contentType = Files.probeContentType(audioPath);

        // MIME type bulunamazsa genel binary tipi fallback olarak kullaniyoruz.
        if (contentType == null) {
            contentType = MediaType.APPLICATION_OCTET_STREAM;
        }

        // Stream edilen dosyayi dogru Content-Length ve Content-Type header'lariyla donuyoruz.
        return Response.ok(streamingOutput)
                .header(HttpHeaders.CONTENT_LENGTH, Files.size(audioPath))
                .type(contentType)
                .build();
    }

    // Dosya uzantisina bakarak bunun desteklenen bir ses dosyasi olup olmadigini kontrol ediyoruz.
    private boolean isSupportedAudioFile(Path path) {
        // Dosya adini kucuk harfe cevirip uzanti kontrolunu sade hale getiriyoruz.
        String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);

        // Tanimli uzantilardan biriyle bitiyorsa dosyayi muzik olarak kabul ediyoruz.
        return SUPPORTED_EXTENSIONS.stream().anyMatch(fileName::endsWith);
    }
}
