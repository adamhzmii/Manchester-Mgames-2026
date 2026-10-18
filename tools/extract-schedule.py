#!/usr/bin/env python3
"""
Reads every group game out of the committee's fixture spreadsheet ("[INTERNAL]
MGAMES 26 FIXTURE SCHEDULE") into tools/schedule-2026.json, which
tools/schedule-2026.mjs turns into the timetable migration:

    python3 tools/extract-schedule.py "<path to the .xlsx>" > tools/schedule-2026.json

Needs openpyxl. Each sport's tab lists its groups down column B and its games
in blocks: a time, then the two teams three columns apart, under a heading that
names the court. Knockouts are not read: their slots are written by hand in
schedule-2026.mjs, where the sheet's numbering is translated.

Stops with an error unless every group plays each pair of its teams exactly once.
"""
import json, re, sys
from itertools import combinations
TABS = [  # (sport, category, tab)
    ('football','open','FOOTBALL','Football Teams'),
    ('basketball','open','BASKETBALL',None), ('netball','open','NETBALL',None),
    ('volleyball','open','VOLLEYBALL',None), ('frisbee','open','FRISBEE',None),
    ('badminton','ms','BADMINTON MS',None), ('badminton','wd','BADMINTON WD',None),
    ('badminton','md','BADMINTON MD',None), ('badminton','xd','BADMINTON XD',None),
    ('pickleball','md','PICKLEBALL MD',None), ('pickleball','xd','PICKLEBALL XD',None),
    ('table-tennis','open','TABLE TENNIS OPEN',None),
]
TIME = re.compile(r'^\d{1,2}:\d{2}$')
import openpyxl

BOOK = openpyxl.load_workbook(sys.argv[1], data_only=True)


def text(v):
    if v is None:
        return ''
    if hasattr(v, 'strftime'):
        return v.strftime('%H:%M')
    return str(v).strip()


def rows(tab):
    return [[text(v) for v in row] for row in BOOK[tab].iter_rows(values_only=True)]
def cell(r,i): return r[i] if i < len(r) else ''

def group_tables(tab):
    """Groups as listed down column B: 'GROUP A' / 'MD GROUP A' / 'XD GROUP', then names."""
    out, cur = {}, None
    for r in rows(tab):
        c = cell(r,1)
        m = re.match(r'^(?:MD |XD )?GROUP(?: ([A-Z]))?$', c)
        if m: cur = m.group(1) or 'A'; out[cur] = []; continue
        if c in ('TEAM','PLAYER',''): continue
        if c == 'RESULTS': cur = None; continue
        if cur and c not in ('W','D','L'): out[cur].append(c)
    return out

def court_name(sport, header, hall):
    h = header.upper()
    if sport == 'football': return 'Pitch ' + re.search(r'PITCH ([A-C])', h).group(1)
    if sport == 'netball': return 'Netball Court ' + re.search(r'COURT ([AB])', h).group(1)
    if sport == 'basketball': return 'Hall A'
    if sport == 'volleyball': return 'Hall B'
    if sport == 'frisbee': return 'Sport Hall'
    if sport == 'table-tennis': return 'Temple Gym ' + re.search(r'TABLE (\d)', h).group(1)
    n = re.search(r'COURT (\d)', h).group(1)
    return f'Court {hall}{n}'

out = []
for sport, cat, tab, teamtab in TABS:
    groups = group_tables(teamtab or tab)
    member = {t: g for g, ts in groups.items() for t in ts}
    R = rows(tab)
    ncols = max(len(r) for r in R)
    games = []
    # Every column that holds a time is a block: its court comes from the nearest heading above it.
    for col in range(ncols):
        header, hall = '', ('D' if sport == 'pickleball' else '')
        for r in R:
            v = cell(r, col)
            if not v: continue
            up = v.upper()
            if 'HALL C' in up: hall = 'C'
            if 'HALL D' in up: hall = 'D'
            if re.search(r'PITCH [A-C]|COURT [A-D1-4]|TABLE \d', up) and not TIME.match(v): header = v
            if TIME.match(v):
                a, b = cell(r, col+1), cell(r, col+4)
                if a in member and b in member:
                    if member[a] != member[b]: sys.exit(f'{tab}: {a} v {b} across groups')
                    games.append({'time': v.zfill(5), 'court': court_name(sport, header, hall), 'group': member[a], 'a': a, 'b': b})
    # Checks: every pair in each group exactly once.
    for g, ts in groups.items():
        want = {frozenset(p) for p in combinations(ts, 2)}
        got = [frozenset((x['a'], x['b'])) for x in games if x['group'] == g]
        if sorted(map(sorted, got)) != sorted(map(sorted, want)) or len(got) != len(want):
            missing = want - set(got); extra = [p for p in got if p not in want or got.count(p) > 1]
            sys.exit(f'{tab} group {g}: {len(got)} games for {len(want)} pairs; missing {[sorted(p) for p in missing]} extra {[sorted(p) for p in extra]}')
    out.append({'sport': sport, 'category': cat, 'groups': groups, 'games': sorted(games, key=lambda x: (x['time'], x['court']))})
    print(f'{sport:12} {cat:5} groups {[(g, len(t)) for g, t in groups.items()]} games {len(games)}  {games and min(x["time"] for x in games)}–{games and max(x["time"] for x in games)}  courts {sorted({x["court"] for x in games})}', file=sys.stderr)
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
print()

