# ECG Görsel Yorumlayıcı

Bu proje, HTML + CSS + JavaScript kullanılarak hazırlanmış, yüklenen bir ECG görüntüsünün ön analizini yapan bir prototip uygulamadır.

## Özellikler

- ECG görüntüsü yükleme
- Görsel önizleme
- Otomatik dalga analizi
- Kalp hızı, QRS, PR, QT tahmini
- Normal / dikkat / yüksek risk çıktıları
- Klinik not ve bulgular listesi

## Kullanım

1. Proje klasörünü açın.
2. `index.html` dosyasını tarayıcıda çalıştırın.
3. ECG görselini yükleyin.
4. Analiz Et butonuna basın.

## Not

Bu uygulama eğitim ve prototip amaçlıdır. Gerçek klinik tanı için kalifiye hekim değerlendirmesi gereklidir.

## Dikkat

Bu uygulama, tıbbi teşhis için kullanılmaz. Kardiyolog gibi karar vermek için gerçek veri, model ve klinik doğrulama gerekir.

## Geliştirme için öneriler

- TensorFlow.js veya Python server ile daha güçlü model entegrasyonu
- ECG görüntüsünü tek bir dalga hattı olarak ayrıştırma
- QRS, P, T dalgası tespiti
- Atrial fibrilasyon / ventriküler taşikardi / ST elevasyon gibi sınıflar için öğrenme tabanlı model
- PDF raporu ve hasta dosyası çıktısı

## Dosya Yapısı

- `index.html` – Ana arayüz
- `styles.css` – Görünüm ve düzen
- `app.js` – Yükleme ve analiz mantığı

## Çalıştırma örneği

```bash
python -m http.server 8000
```

Ardından tarayıcıda:

```text
http://localhost:8000
```

