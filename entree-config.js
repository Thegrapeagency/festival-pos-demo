// Waar het Entree-dashboard, de ticketshop, de ticketpagina en de scanner hun
// gegevens halen. De sleutel hieronder is de publieke (anon) sleutel: die mag
// in de browser staan, de database-regels bepalen wat ermee kan.
window.ENTREE = {
  SUPABASE_URL: 'https://snfojphxsbzfewwfbfka.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZm9qcGh4c2J6ZmV3d2ZiZmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQwMzMsImV4cCI6MjA5NjE3MDAzM30.uwgcP8M5mX2CdA9AW8qLVI7BO3KtPJCNmnn_AhDKr7E',
  // Publiek adres van deze site (zonder slash aan het eind). Leeg = automatisch.
  BASE_URL: '',
};
