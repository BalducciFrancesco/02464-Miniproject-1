import os
import csv
import glob
import argparse
from typing import List, Tuple
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import math

# ---------- util ----------
def sniff_delimiter(path: str) -> str:
    with open(path, 'r', newline='', encoding='utf-8') as f:
        sample = f.read(2048)
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample, delimiters=";,|\t,")
            return dialect.delimiter
        except Exception:
            return ';'  # default alle specifiche: "sample; guess"

def load_trial(path: str) -> Tuple[List[str], List[str]]:
    """
    Ritorna:
      samples: lista degli item presentati in ordine seriale (una riga = un item)
      guesses: lista degli item ricordati (ordine ignorato)
    """
    delim = sniff_delimiter(path)
    df = pd.read_csv(path, sep=delim, engine='python')
    cols = {c.strip().lower(): c for c in df.columns}
    if "sample" not in cols or "guess" not in cols:
        raise ValueError(f"{os.path.basename(path)} deve contenere le colonne 'sample' e 'guess'")
    s_col, g_col = cols["sample"], cols["guess"]
    samples = [str(x).strip() for x in df[s_col].tolist() if pd.notna(x) and str(x).strip() != ""]
    guesses  = [str(x).strip() for x in df[g_col].tolist() if pd.notna(x) and str(x).strip() != ""]
    return samples, guesses

def wilson_ci(k: int, n: int, z: float = 1.96) -> Tuple[float, float]:
    """Intervallo di confidenza di Wilson per proporzioni (95% di default)."""
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    denom = 1 + (z**2)/n
    centre = (p + (z**2)/(2*n)) / denom
    half = (z * math.sqrt((p*(1-p) + (z**2)/(4*n)) / n)) / denom
    return (centre - half, centre + half)

# ---------- analisi ----------
def analyze_folder(folder: str, save_prefix: str = "free_recall"):
    files = sorted(glob.glob(os.path.join(folder, "*.csv")))
    if not files:
        raise FileNotFoundError(f"Nessun CSV trovato in: {folder}")

    trials = []
    max_len = 0
    for fp in files:
        samples, guesses = load_trial(fp)
        trials.append((fp, samples, guesses))
        max_len = max(max_len, len(samples))

    # contatori per la curva serial-position (NO CI nel grafico)
    pos_k = np.zeros(max_len, dtype=int)  # corretti
    pos_n = np.zeros(max_len, dtype=int)  # numero di prove con quella posizione

    # riepilogo per file (1 riga per trial, con CI)
    per_trial_rows = []

    # contatori globali
    K_total = 0
    N_total = 0

    for fp, samples, guesses in trials:
        guess_set = set(guesses)  # ordine ignorato
        k_file = 0
        n_file = len(samples)

        # aggiorna per posizione e globale
        for i, item in enumerate(samples):
            correct = int(item in guess_set)
            pos_k[i] += correct
            pos_n[i] += 1
            K_total += correct
            N_total += 1
            k_file += correct

        # per-trial proportion + CI (Wilson)
        p_file = (k_file / n_file) if n_file > 0 else np.nan
        lo_t, hi_t = wilson_ci(k_file, n_file)
        per_trial_rows.append({
            "file": os.path.basename(fp),
            "n_items": n_file,
            "k_correct": k_file,
            "prop_correct": p_file,
            "ci95_lower": lo_t,
            "ci95_upper": hi_t,
            "percent_correct": (p_file * 100) if n_file > 0 else np.nan,
            "ci95_lower_percent": (lo_t * 100) if n_file > 0 else np.nan,
            "ci95_upper_percent": (hi_t * 100) if n_file > 0 else np.nan
        })

    # --- output 1: grafico serial-position (SENZA CI) ---
    percent = []
    x = list(range(1, max_len + 1))
    for i in range(max_len):
        n = pos_n[i]
        k = pos_k[i]
        pct = (k / n) * 100 if n > 0 else np.nan
        percent.append(pct)

    plt.figure()
    plt.plot(x, percent, marker="o")
    plt.xlabel("Serial position")
    plt.ylabel("Percent recall")
    plt.title("Free recall — Percent correct vs Serial position")
    fig_path = f"{save_prefix}_serial_position.png"
    plt.savefig(fig_path, bbox_inches="tight")
    plt.close()

    # --- output 2: globale (k/N) + CI (solo in CSV) ---
    p_global = (K_total / N_total) if N_total > 0 else np.nan
    lo_g, hi_g = wilson_ci(K_total, N_total)
    global_df = pd.DataFrame([{
        "n_items_total": N_total,
        "k_correct_total": K_total,
        "prop_correct_global": p_global,
        "ci95_lower": lo_g,
        "ci95_upper": hi_g,
        "percent_correct_global": (p_global * 100) if N_total > 0 else np.nan,
        "ci95_lower_percent": (lo_g * 100) if N_total > 0 else np.nan,
        "ci95_upper_percent": (hi_g * 100) if N_total > 0 else np.nan
    }])
    out_global = f"{save_prefix}_global_summary.csv"
    global_df.to_csv(out_global, index=False)

    # --- output 3: per-file (con CI, ma NO righe per posizione) ---
    per_trial_df = pd.DataFrame(per_trial_rows).sort_values("file")
    out_per_trial = f"{save_prefix}_per_trial_summary.csv"
    per_trial_df.to_csv(out_per_trial, index=False)

    print(f"[Globale] k/N = {K_total}/{N_total}  ->  {p_global*100:.1f}%  (95% CI: {lo_g*100:.1f}–{hi_g*100:.1f}%)")
    print(f"Salvati: {fig_path}, {out_global}, {out_per_trial}")

    return fig_path, out_global, out_per_trial

def main():
    ap = argparse.ArgumentParser(description="FREE RECALL: grafico senza CI; CSV globali e per-trial con CI.")
    ap.add_argument("--folder", required=True, help="Cartella con i CSV (uno per trial) con colonne 'sample' e 'guess'")
    ap.add_argument("--prefix", default="free_recall", help="Prefisso per i file di output")
    args = ap.parse_args()
    analyze_folder(args.folder, args.prefix)

if __name__ == "__main__":
    main()
