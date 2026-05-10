package com.yhcanbay.melodify;

import com.yhcanbay.melodify.service.MusicService;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.List;

@Path("/music")
public class MusicResource {

    // Muzik islemlerini servis sinifina tasiyoruz.
    private final MusicService musicService = new MusicService();

    // Frontend'in muzik listesini cekmesi icin JSON endpoint'i sagliyoruz.
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listMusic() throws IOException {
        // Servisten tum muzik dosyalarinin isimlerini aliyoruz.
        List<MusicItemResponse> musicItems = musicService.listMusicFiles().stream()
                .map(fileName -> new MusicItemResponse(
                        fileName,
                        removeExtension(fileName)
                ))
                .toList();

        // JSON cevabini React gelistirme ortaminda da okunabilmesi icin CORS header ile donuyoruz.
        return Response.ok(musicItems)
                .header("Access-Control-Allow-Origin", "*")
                .build();
    }

    // Secilen muzik dosyasinin stream edilmesi icin GET endpoint'i sagliyoruz.
    @GET
    @Path("/{fileName}")
    public Response streamMusic(@PathParam("fileName") String fileName) throws IOException {
        // Servisten gelen stream cevabina CORS header ekleyerek frontend'in erisimini kolaylastiriyoruz.
        return withCors(musicService.getMusic(fileName)).build();
    }

    // Var olan response'taki durum, entity ve header'lari koruyarak uzerine CORS ekliyoruz.
    private Response.ResponseBuilder withCors(Response response) {
        // Response'u yeni builder'a kopyalayip CORS header eklemek icin fromResponse kullaniyoruz.
        return Response.fromResponse(response)
                .header("Access-Control-Allow-Origin", "*");
    }

    // Gorunumde daha temiz baslik gostermek icin dosya uzantisini kaldiriyoruz.
    private String removeExtension(String fileName) {
        // Son nokta konumunu bulup uzanti varsa ismi oraya kadar kesiyoruz.
        int lastDotIndex = fileName.lastIndexOf('.');

        // Uzanti yoksa dosya adini oldugu gibi geri donuyoruz.
        if (lastDotIndex <= 0) {
            return fileName;
        }

        // Uzantiyi atip sadece gorunecek basligi donuyoruz.
        return fileName.substring(0, lastDotIndex);
    }

    // Frontend'in kullanacagi basit muzik karti veri yapisini tanimliyoruz.
    public record MusicItemResponse(String fileName, String title) {
    }
}
