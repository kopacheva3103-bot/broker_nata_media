import cv2, numpy as np


def clean_mask(frame, a):
    """Remove the cream chair from a person matte: low-saturation yellow-green pixels in big patches.
    Skin and hair are orange and saturated, so the hue test leaves them alone."""
    f = frame.astype(np.uint8)
    hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    chair = (h >= 18) & (h <= 70) & (s < 75) & (v > 140)
    H = a.shape[0]
    chair[: int(H * 0.25)] = False
    kill = (chair & (a > 60)).astype(np.uint8)
    kill = cv2.morphologyEx(kill, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(kill, 8)
    outside = cv2.dilate((a <= 60).astype(np.uint8), np.ones((21, 21), np.uint8))  # touches the background
    edge_hits = np.bincount(lab[outside > 0].ravel(), minlength=n)
    big = np.zeros(n, np.uint8)
    big[1:] = (st[1:, cv2.CC_STAT_AREA] > 2500) & (edge_hits[1:] > 40)
    kill = cv2.dilate(big[lab], np.ones((11, 11), np.uint8))
    a = a * (1 - kill)
    hard = (a > 127).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 1:
        b = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        a = a * cv2.dilate((lab == b).astype(np.uint8), np.ones((15, 15), np.uint8))
    return cv2.GaussianBlur(a, (0, 0), 1.2)
