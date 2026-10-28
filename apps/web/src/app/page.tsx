import { redirect } from 'next/navigation';
import { currentUser, userProjects } from '@/lib/auth';
import { NewProjectForm } from './new-project-form';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const projects = await userProjects(user.id);

  return (
    <>
      <h1>Your projects</h1>
      <p className="lede">Signed in as {user.email}.</p>

      {projects.length === 0 ? (
        <p>You have no projects yet. Create one below and you will get your keys straight away.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Keys</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.publicId}>
                  <td>{p.name}</td>
                  <td>
                    <a href={`/projects/${p.publicId}`}>Open</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>New project</h2>
      <NewProjectForm />
    </>
  );
}
