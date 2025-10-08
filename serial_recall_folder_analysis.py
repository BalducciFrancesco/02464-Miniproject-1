import os
import csv
import glob
import argparse
from typing import List, Tuple
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import math

# ============== UTIL ==============
def sniff_delimiter(path: str) -> str:
    with open(path, 'r', newline='', encoding='utf-8') as f:
        sample = f.read(2048)
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample, delimiters=";,|\t,")
            return dialect.delimiter
        except Exception:
            return ';'  # default: "sample; guess"

def load_trial(path: str) -> Tuple[List[str], List[str]]:
    """
    Legge un CSV di un trial:
    - 'sample' (presentati) in ordine seriale (1..10)
    - 'guess'  (risposte)  in ordine seriale (1..10)
    Ritorna (samples, guesses) come liste di stringhe ("" se vuoto).
    """
    delim = sniff_delimiter(path)
    df = pd.read_csv(path, sep=delim, engine='python')

    # normalizza nomi colonne
    cols = {c.strip().lower(): c for c in df.columns}
    if "sample" not in cols or "guess" not in cols:
        raise ValueError(f"{os.path.basename(path)} deve contenere le colonne 'sample' e 'guess'")
    s_col, g_col = cols["sample"], cols["guess"]

    samples = [("" if pd.isna(x) else str(x).strip()) for x in df[s_col].tolist()]
    guesses  = [("" if pd.isna(x) else str(x).strip()) for x in df[g_col].tolist()]

    return samples, guesses

def wilson_ci(k: int, n: int, z: float = 1.96) -> Tuple[float, float]:
    """Intervallo di confidenza di Wilson (95% default) per proporzioni."""
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    denom = 1 + (z**2)/n
    centre = (p + (z**2)/(2*n)) / denom
    half = (z * math.sqrt((p*(1-p) + (z**2)/(4*n)) / n)) / denom
    return (centre - half, centre + half)

# Classificazione errori per serial recall:
# - correct: guess == sample (stessa posizione)
# - omission: guess == "" (vuoto)
# - transposition: guess è presente in sample ma in POSIZIONE diversa
# - intrusion: guess non è presente in sample
def classify_errors(samples: List[str], guesses: List[str]) -> List[str]:
    errors = []
    sample_list = list(samples)  # per ricerca membership
    for i, (s, g) in enumerate(zip(samples, guesses)):
        if g == "" or g is None:
            errors.append("omission")
        elif g == s:
            errors.append("correct")
        elif g in sample_list:
            errors.append("transposition")
        else:
            errors.append("intrusion")
    return errors

# ============== ANALISI ==============
def analyze_folder(folder: str, save_prefix: str = "serial_recall"):
    files = sorted(glob.glob(os.path.join(folder, "*.csv")))
    if not files:
        raise FileNotFoundError(f"Nessun CSV trovato in: {folder}")

    trials = []
    seq_len = None
    for fp in files:
        samples, guesses = load_trial(fp)
        if seq_len is None:
            seq_len = len(samples)
        trials.append((fp, samples, guesses))

    if seq_len is None:
        raise ValueError("Impossibile determinare la lunghezza sequenza.")

    # Per grafico serial position (senza CI)
    pos_k = np.zeros(seq_len, dtype=int)  # corretti per posizione
    pos_n = np.zeros(seq_len, dtype=int)  # conteggi validi per posizione

    # Per CSV per-trial
    per_trial_rows = []

    # Per errori per-trial
    err_rows = []

    # Globale
    K_total = 0
    N_total = 0

    for fp, samples, guesses in trials:
        # padding/troncamento difensivo alla lunghezza attesa
        if len(samples) != seq_len:
            samples = (samples + [""] * seq_len)[:seq_len]
        if len(guesses) != seq_len:
            guesses = (guesses + [""] * seq_len)[:seq_len]

        errors = classify_errors(samples, guesses)

        # per posizione / globale
        k_file = 0
        for i, (s, g, e) in enumerate(zip(samples, guesses, errors)):
            if e == "correct":
                pos_k[i] += 1
                k_file += 1
                K_total += 1
            pos_n[i] += 1
            N_total += 1

        # per-trial summary + CI
        n_file = seq_len
        p_file = k_file / n_file if n_file > 0 else np.nan
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

        # errori per-trial: conteggi e percentuali
        from collections import Counter
        c = Counter(errors)
        total = sum(c.values())
        def frac(k): return c.get(k, 0) / total if total else np.nan

        err_rows.append({
            "file": os.path.basename(fp),
            "n_items": total,
            "correct_count": c.get("correct", 0),
            "omission_count": c.get("omission", 0),
            "transposition_count": c.get("transposition", 0),
            "intrusion_count": c.get("intrusion", 0),
            "correct_prop": frac("correct"),
            "omission_prop": frac("omission"),
            "transposition_prop": frac("transposition"),
            "intrusion_prop": frac("intrusion"),
            "correct_percent": frac("correct")*100 if total else np.nan,
            "omission_percent": frac("omission")*100 if total else np.nan,
            "transposition_percent": frac("transposition")*100 if total else np.nan,
            "intrusion_percent": frac("intrusion")*100 if total else np.nan,
        })

    # -------- Output 1: grafico per posizione (SENZA CI)
    x = list(range(1, seq_len + 1))
    percent = [(pos_k[i] / pos_n[i]) * 100 if pos_n[i] > 0 else np.nan for i in range(seq_len)]

    plt.figure()
    plt.plot(x, percent, marker="o")
    plt.xlabel("Serial position")
    plt.ylabel("Percent correct")
    plt.title("Serial recall — Percent correct vs Serial position")
    fig_path = f"{save_prefix}_serial_position.png"
    plt.savefig(fig_path, bbox_inches="tight")
    plt.close()

    # -------- Output 2: globale (k/N) + CI (solo in CSV)
    p_global = K_total / N_total if N_total > 0 else np.nan
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

    # -------- Output 3: per-trial (con CI)
    per_trial_df = pd.DataFrame(per_trial_rows).sort_values("file")
    out_per_trial = f"{save_prefix}_per_trial_summary.csv"
    per_trial_df.to_csv(out_per_trial, index=False)

    # -------- Output 4: errori per-trial (conteggi e percentuali)
    errors_df = pd.DataFrame(err_rows).sort_values("file")
    out_errors = f"{save_prefix}_error_types_per_trial.csv"
    errors_df.to_csv(out_errors, index=False)

    print(f"[Globale] k/N = {K_total}/{N_total} -> {p_global*100:.1f}%  (95% CI: {lo_g*100:.1f}–{hi_g*100:.1f}%)")
    print(f"Salvati: {fig_path}, {out_global}, {out_per_trial}, {out_errors}")

    return fig_path, out_global, out_per_trial, out_errors

def main():
    ap = argparse.ArgumentParser(description="SERIAL RECALL: grafico senza CI, globale+CI, per-trial+CI, errori per-trial.")
    ap.add_argument("--folder", required=True, help="Cartella con CSV (uno per trial) con colonne 'sample' e 'guess' (stessa lunghezza, ordine seriale).")
    ap.add_argument("--prefix", default="serial_recall", help="Prefisso per gli output")
    args = ap.parse_args()
    analyze_folder(args.folder, args.prefix)

if __name__ == "__main__":
    main()
