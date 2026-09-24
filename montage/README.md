# montage — монтаж вертикальных роликов

Собирает ролик 1080×1920 (Reels / Shorts / TikTok) из видео, фото и слайдов:

- **цветокоррекция**: пресеты (`interior`, `cinematic`, `warm`, `film`, `bw`…) и ручные настройки (яркость, контраст, насыщенность, гамма, температура, тени/света, кривые, LUT `.cube`, виньетка, резкость, зерно);
- **субтитры** в стиле Reels: по 2–4 слова, подсветка текущего слова, из `.srt`, списком в проекте или автоматически через Whisper;
- **слайды**: фон (цвет, градиент или размытое фото), заголовок, текст, пункты, которые появляются по очереди, анимации;
- **видеоряд**: обрезка клипов, скорость, подгонка под 9:16 (обрезка или размытый фон), эффект Кена Бёрнса на фото, подписи поверх кадра, переходы (`fade`, `slideup`, `wipeleft`, `circleopen`… всего около 50 видов);
- **звук**: закадровая озвучка отдельным файлом (`audio.voiceover`), фоновая музыка по кругу, плавное появление и затухание, приглушение музыки под голос, громкость −14 LUFS;
- логотип или водяной знак.

## Установка (один раз)

1. **ffmpeg**: `brew install ffmpeg` (macOS), `sudo apt install ffmpeg` (Ubuntu), `winget install Gyan.FFmpeg` (Windows).
2. **Python 3.10+** и зависимости: `pip install -r montage/requirements.txt`.
3. По желанию, для автосубтитров: `pip install faster-whisper`.

## Куда класть материал

Для каждого ролика заведите свою папку. Удобнее держать её **на своём компьютере**, а не в этом репозитории: он публичный, а у GitHub есть лимит 100 МБ на файл.

```
reels/
└── ostrov/
    ├── project.yaml      ← сценарий ролика (что за чем идёт)
    ├── clips/            ← видео с телефона: .mp4 .mov
    ├── photos/           ← фото: .jpg .png .webp
    ├── music/            ← трек: .mp3 .wav .m4a
    ├── voice.m4a         ← закадровый голос (по желанию)
    ├── subs.srt          ← субтитры (или subtitles.auto: true)
    └── logo.png          ← логотип (по желанию)
```

Пути в `project.yaml` пишутся относительно самого файла: `clips/room.mp4`, `photos/facade.jpg`.

## Запуск

```bash
python -m montage render reels/ostrov/project.yaml --preview   # черновик за секунды, 540×960
python -m montage render reels/ostrov/project.yaml             # финальный рендер
python -m montage transcribe clips/talk.mp4                             # речь → talk.srt
python -m montage presets                                               # список пресетов цвета
```

Готовые сегменты кэшируются в `out/.montage_cache`, поэтому при правке одного сегмента перерисовывается только он.

## Сценарий ролика (project.yaml)

Полный пример с комментариями: [`example/project.yaml`](example/project.yaml). Кратко:

```yaml
output: out/reel.mp4
grade: interior                      # цвет для всего ролика
transition: {type: fade, duration: 0.4}
audio: {music: music/track.mp3, music_volume: 0.3}
subtitles: {srt: subs.srt, max_words: 3, uppercase: true}

segments:
  - type: slide                      # титульный слайд
    duration: 3
    background: {gradient: ["#0f2027", "#2c5364"]}
    title: "ЖК Остров"
    bullets: ["3 спальни", "Вид на парк"]

  - src: clips/living.mp4            # видео: тип определяется по расширению
    start: 2.5
    end: 7
    fit: blur
    text: "Гостиная 45 м²"
    grade: {preset: cinematic, saturation: 1.1}
    transition: wipeleft             # переход к следующему сегменту

  - src: photos/facade.jpg           # фото с наездом камеры
    duration: 3.5
    motion: zoom_in

  - type: slide
    duration: 3
    background: {image: photos/facade.jpg, blur: 40, darken: 0.45}
    title: "Звоните"
    text: "+7 900 000-00-00"
    animation: pop
```

### Параметры сегментов

| Поле | Где | Значение |
|---|---|---|
| `src` | видео, фото | путь к файлу |
| `start`, `end` / `duration` | видео | какой кусок исходника взять, в секундах |
| `duration` | фото, слайд | длина на экране |
| `speed` | видео | 0.5 — замедление, 2 — ускорение |
| `volume`, `mute` | видео | громкость оригинального звука |
| `fit` | видео, фото | `fill` (обрезать под 9:16), `blur` (размытый фон), `fit` (чёрные поля) |
| `focus_x`, `focus_y` | видео, фото | точка кадра, которую сохранять при `fill` (0…1) |
| `motion`, `zoom` | фото, слайд | `zoom_in`, `zoom_out`, `pan_left`, `pan_right`, `pan_up`, `pan_down`, `none`; сила наезда 0.12 |
| `text` | видео, фото | подпись: строка, `{text, position, start, end, animation}` или список таких подписей |
| `text_position` | все | `top`, `middle`, `bottom` или доля высоты кадра, например 0.4 |
| `title`, `text`, `bullets` | слайд | заголовок, текст (перенос строки: `\n`), пункты |
| `background` | слайд | `"#112233"`, `{gradient: [...], direction: vertical/horizontal/diagonal}`, `{image, blur, darken}` |
| `animation` | слайд | `fade`, `slide_up`, `slide_down`, `pop`, `none` |
| `grade` | все | пресет или словарь; `none` — без цветокоррекции |
| `transition` | все | переход к следующему сегменту: `fade`, `slideup`, `wipeleft`, `circleopen`, `cut`…; `{type, duration}` |

Стили текста задаются в `styles:` (`title`, `text`, `caption`, `subtitle`) и `subtitle_style:`. Доступные поля: `size`, `color`, `highlight`, `outline`, `outline_color`, `shadow`, `bold`, `box`, `box_color`, `box_opacity`, `font`. Размеры указываются для кадра 1080×1920.

## Ролик с речью на камеру

```yaml
font: "PT Serif"
uniform_transitions: true               # один и тот же переход везде
transition: {type: fade, duration: 0.25}
beauty: {skin_smooth: 0.14, skin_tone: 0.5}   # разглаживание кожи 14 %, выравнивание тона
subtitles:
  position: top_right                    # top_right | top_left | bottom_right | bottom_left | top | bottom
  margin_cm: 0.5                         # отступ от краёв экрана телефона
  karaoke: false                         # без подсветки слов
  model: large-v3                        # точнее распознаёт русский (медленнее)
  replace: {каборг: коворкинг}           # исправить ошибки распознавания
styles:
  subtitle: {font: "PT Serif", color: "#FFFFFF", bold: false, size: 60, outline: 2}

segments:
  - src: clips/talk.mov
    cleanup:                             # вырезать паузы, «э-э», неудачные дубли
      max_pause: 0.35                    # паузы длиннее — сокращаются
      cut_retakes: true                  # запнулась и повторила — первая попытка удаляется
      remove: [[12.0, 15.5]]             # вырезать вручную (секунды исходника)
    broll:                               # перебивки: картинка меняется, голос идёт
      - {src: clips/lobby.mov, at: "лобби", duration: 3}     # по фразе из речи
      - {src: photos/river.jpg, at: 42.0, duration: 2.5}    # по секунде исходника
```

После рендера рядом с роликом появляется `*.cuts.txt`: там перечислено, что вырезано и почему.
Сглаживание и выравнивание тона действуют только на участки цвета кожи, глаза, брови и губы остаются чёткими.
Отступ в сантиметрах рассчитан на экран телефона шириной около 6,6 см (`screen_width_cm`).

## Как поставить задачу на монтаж

Отдельный «промт» писать не нужно: задание для программы — это `project.yaml`. Если не хочется писать YAML вручную, выложите материал в папку и опишите ролик словами, а `project.yaml` по этому описанию соберёт Claude. Примерный бриф:

```
Ролик 20–25 сек про ЖК «Остров», тон — премиум, спокойный.
Материал: clips/ (3 видео), photos/ (6 фото), music/calm.mp3.
1) Титр: «ЖК Остров · 137 м²», тёмно-синий градиент.
2) Фасад: photos/facade.jpg, медленный наезд.
3) Гостиная: clips/living.mp4 с 3-й по 8-ю секунду, подпись «Гостиная 45 м²».
4) Вид из окна: clips/view.mp4, замедлить.
5) Финальный слайд: «Звоните: +7 …», фон — размытый фасад.
Цвет: светлый, тёплый. Озвучка: voice.m4a, субтитры распознать из неё, жёлтая подсветка слов.
Музыка тихо, под голос приглушать.
```
