import {type ReactNode, useEffect} from 'react';
import {activity, loadTeam, type Person, projects, stats, useTeam, weeklyTasks} from './data.ts';
import {Icon} from './icons.tsx';

function Avatar({person}: {readonly person: Person}): ReactNode {
  return (
    <span className="avatar" style={{background: person.color}} aria-hidden="true">
      {person.initials}
    </span>
  );
}

function PageHeader({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

function Progress({value, label}: {readonly value: number; readonly label: string}): ReactNode {
  return (
    <span
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{width: `${value}%`}} />
    </span>
  );
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function TasksChart(): ReactNode {
  const width = 420;
  const height = 120;
  const max = Math.max(...weeklyTasks) * 1.15;
  const points = weeklyTasks.map((value, index) => {
    const x = (index / (weeklyTasks.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Tasks completed per day this week"
      >
        <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} className="chart-area" />
        <polyline points={points.join(' ')} className="chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="chart-days">
        {days.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </figcaption>
    </figure>
  );
}

export function DashboardPage(): ReactNode {
  return (
    <>
      <PageHeader title="Good morning, Sam" subtitle="Here's what's happening across your projects." />

      <section className="stats" aria-label="This week">
        {stats.map((stat) => (
          <div key={stat.label} className="card stat">
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-trend">{stat.trend}</span>
          </div>
        ))}
      </section>

      <div className="split">
        <section className="card">
          <h2>Tasks completed</h2>
          <TasksChart />
        </section>
        <section className="card">
          <h2>Projects</h2>
          <ul className="project-list">
            {projects.slice(0, 3).map((project) => (
              <li key={project.name}>
                <span className="project-name">{project.name}</span>
                <Progress value={project.progress} label={project.name} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" data-tour="activity">
        <h2>Recent activity</h2>
        <ul className="activity">
          {activity.map((entry) => (
            <li key={entry.subject}>
              <Avatar person={entry.person} />
              <span className="activity-text">
                <strong>{entry.person.name}</strong> {entry.action} <strong>{entry.subject}</strong>
                <span className="muted"> · {entry.project}</span>
              </span>
              <time className="muted">{entry.time}</time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function TeamPage(): ReactNode {
  const {members, isLoading} = useTeam();

  useEffect(() => {
    void loadTeam();
  }, []);

  return (
    <>
      <PageHeader title="Team" subtitle="The people working on your projects.">
        <button type="button" className="button button-primary" data-tour="invite">
          <Icon name="mail" size={16} />
          Invite teammates
        </button>
      </PageHeader>

      <section className="card" aria-busy={isLoading}>
        <ul className="members">
          {isLoading || members.length === 0
            ? [1, 2, 3, 4].map((row) => (
                <li key={row} className="skeleton" aria-hidden="true">
                  <span className="avatar" />
                  <span className="skeleton-line" />
                </li>
              ))
            : members.map((member) => (
                <li key={member.name}>
                  <Avatar person={member} />
                  <span>
                    <strong>{member.name}</strong>
                    <span className="muted member-role">{member.role}</span>
                  </span>
                </li>
              ))}
        </ul>
      </section>
    </>
  );
}

export function ProjectsPage(): ReactNode {
  return (
    <>
      <PageHeader title="Projects" subtitle="Everything your team is building." />
      <div className="project-grid">
        {projects.map((project) => (
          <section key={project.name} className="card project-card">
            <h2>{project.name}</h2>
            <Progress value={project.progress} label={project.name} />
            <span className="muted">
              {project.progress}% · due {project.due}
            </span>
          </section>
        ))}
      </div>
    </>
  );
}

export function SettingsPage(): ReactNode {
  return (
    <>
      <PageHeader title="Settings" subtitle="Notifications and preferences." />
      <section className="card settings">
        {['Email me about mentions', 'Weekly summary', 'Desktop notifications'].map((label, index) => (
          <label key={label} className="setting">
            {label}
            <input type="checkbox" defaultChecked={index !== 2} />
          </label>
        ))}
      </section>
    </>
  );
}
