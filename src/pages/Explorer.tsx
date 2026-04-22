import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid2 as Grid,
  CircularProgress,
  Stack,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,

  Fade,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useAppStore } from '../store';
import { searchRepositories, buildSearchQuery, searchIssues } from '../services/github';
import { scoreRepo, scoreIssue } from '../services/scorer';
import RepoCard from '../components/RepoCard';
import IssueCard from '../components/IssueCard';
import type { Repo, Issue, ScoreResult } from '../types';

export default function Explorer() {
  const {
    languages,
    frameworks,
    tools,
    minStars,
    maxStars,
    issueLabels,
    selectedRepo,
    setSelectedRepo,
    setSelectedIssue,
    setCurrentPage,
    showNotification,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [repos, setRepos] = useState<{ repo: Repo; score: ScoreResult }[]>([]);
  const [issues, setIssues] = useState<{ issue: Issue; score: number }[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'stars' | 'updated'>('score');
  const [languageFilter, setLanguageFilter] = useState('');
  const [starsRange, setStarsRange] = useState<number[]>([minStars, maxStars > 50000 ? 50000 : maxStars]);

  const prefs = useMemo(() => ({
    languages, frameworks, tools, minStars, maxStars, issueLabels,
  }), [languages, frameworks, tools, minStars, maxStars, issueLabels]);

  const handleSearch = useCallback(async () => {
    setLoadingRepos(true);
    try {
      let query = searchQuery;
      if (!query) {
        query = buildSearchQuery({
          languages: languages.map((t) => t.name),
          topics: [...frameworks, ...tools].map((t) => t.name),
          minStars: starsRange[0],
          maxStars: starsRange[1],
        });
      }

      if (languageFilter) {
        query += ` language:${languageFilter}`;
      }

      const { items } = await searchRepositories(query, {
        sort: sortBy === 'score' ? 'stars' : sortBy,
        perPage: 30,
      });

      const scored = items
        .map((repo) => ({
          repo,
          score: scoreRepo(repo, prefs),
        }))
        .sort((a, b) => {
          if (sortBy === 'score') return b.score.total - a.score.total;
          if (sortBy === 'stars') return b.repo.stargazers_count - a.repo.stargazers_count;
          return new Date(b.repo.updated_at).getTime() - new Date(a.repo.updated_at).getTime();
        });

      setRepos(scored);
      setSelectedRepo(null);
      setIssues([]);
    } catch (err) {
      showNotification(`搜索失败: ${err}`, 'error');
    } finally {
      setLoadingRepos(false);
    }
  }, [searchQuery, languages, frameworks, tools, starsRange, languageFilter, sortBy, prefs, setSelectedRepo, showNotification]);

  const handleSelectRepo = useCallback(async (repo: Repo) => {
    setSelectedRepo(repo);
    setLoadingIssues(true);
    try {
      const repoIssues = await searchIssues(repo.full_name, {
        labels: issueLabels.length > 0 ? issueLabels : undefined,
        state: 'open',
        perPage: 20,
      });

      const scored = repoIssues
        .map((issue) => ({
          issue: { ...issue, repo_full_name: repo.full_name },
          score: scoreIssue(issue, issueLabels),
        }))
        .sort((a, b) => b.score - a.score);

      setIssues(scored);
    } catch (err) {
      showNotification(`加载 Issue 失败: ${err}`, 'error');
    } finally {
      setLoadingIssues(false);
    }
  }, [issueLabels, setSelectedRepo, showNotification]);

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder="搜索 GitHub 项目（留空使用偏好自动搜索）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loadingRepos}
            sx={{ minWidth: 100 }}
          >
            {loadingRepos ? <CircularProgress size={20} color="inherit" /> : '搜索'}
          </Button>
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <FilterIcon sx={{ color: 'text.secondary', fontSize: 20 }} />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>排序方式</InputLabel>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} label="排序方式">
              <MenuItem value="score">匹配度</MenuItem>
              <MenuItem value="stars">星标数</MenuItem>
              <MenuItem value="updated">最近更新</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="语言筛选"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            sx={{ width: 140 }}
          />

          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              星标: {starsRange[0].toLocaleString()} - {starsRange[1].toLocaleString()}
            </Typography>
            <Slider
              value={starsRange}
              onChange={(_, v) => setStarsRange(v as number[])}
              min={0}
              max={50000}
              step={100}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${(v / 1000).toFixed(1)}k`}
            />
          </Box>
        </Stack>
      </Box>

      {/* Content: Two-column layout */}
      <Box sx={{ flex: 1, display: 'flex', gap: 3, overflow: 'hidden' }}>
        {/* Left: Repos */}
        <Box
          sx={{
            flex: selectedRepo ? '0 0 45%' : '1',
            overflow: 'auto',
            transition: 'flex 0.3s ease',
            pr: 1,
          }}
        >
          {loadingRepos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : repos.length > 0 ? (
            <Grid container spacing={2}>
              {repos.map(({ repo, score }) => (
                <Grid size={{ xs: 12, sm: selectedRepo ? 12 : 6, md: selectedRepo ? 12 : 4 }} key={repo.id}>
                  <Fade in timeout={400}>
                    <Box>
                      <RepoCard
                        repo={repo}
                        score={score}
                        onClick={() => handleSelectRepo(repo)}
                      />
                    </Box>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5,
              }}
            >
              <SearchIcon sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6">开始搜索项目</Typography>
              <Typography variant="body2" color="text.secondary">
                输入关键词或使用偏好自动搜索
              </Typography>
            </Box>
          )}
        </Box>

        {/* Right: Issues panel */}
        {selectedRepo && (
          <Fade in timeout={400}>
            <Box
              sx={{
                flex: '0 0 55%',
                borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
                pl: 3,
                overflow: 'auto',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedRepo.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    开放 Issue 列表
                  </Typography>
                </Box>
                <Chip
                  label="关闭"
                  size="small"
                  onClick={() => {
                    setSelectedRepo(null);
                    setIssues([]);
                  }}
                />
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {loadingIssues ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : issues.length > 0 ? (
                issues.map(({ issue, score }) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    score={score}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setCurrentPage('issue-detail');
                    }}
                  />
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>
                  <Typography>暂无匹配的 Issue</Typography>
                  <Typography variant="caption" color="text.secondary">
                    试试调整偏好中的标签过滤
                  </Typography>
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
}
